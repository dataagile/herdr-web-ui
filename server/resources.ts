import { cpus, freemem, homedir, totalmem } from "node:os";
import { readdir, readFile, statfs } from "node:fs/promises";

import type { MachineResources, PaneResources, ResourceMeter } from "../shared/protocol.ts";
import { herdrRpc } from "./herdr/client.ts";
import { jsonResponse } from "./http.ts";

/** One reading serves every client asking within this window, so two devices polling do not halve each other's CPU interval. */
const FRESH_MS = 2_000;
/** Windows' numbers come from PowerShell, which takes a second to start: read them at most this often. */
const WINDOWS_TABLE_MS = 10_000;
const WINDOWS_TIMEOUT_MS = 10_000;
const MAX_PANES = 200;
/** A pane herdr named no shell for is asked again after this long, not on every read. */
const NO_SHELL_MS = 10_000;
/** CPU over a longer gap (a page hidden for an hour) is an average, not "now": it reads as unknown instead. */
const MAX_CPU_GAP_MS = 20_000;
const PANE_ID = /^[\w.:-]{1,100}$/;
// ponytail: Linux's USER_HZ is 100 on every mainstream kernel and no API outside sysconf exposes it
const LINUX_TICK_MS = 10;
/**
 * The page file in MB, as Win32_PageFileUsage reports it, and per process its parent, working set
 * (bytes), CPU time (100 ns units) and start (ms since 1970, 0 when Windows gives none), all as numbers.
 */
const WINDOWS_SCRIPT = "$u=0;$t=0;Get-CimInstance Win32_PageFileUsage | ForEach-Object { $u+=$_.CurrentUsage; $t+=$_.AllocatedBaseSize }; @{swap=@($u,$t); procs=@(Get-CimInstance Win32_Process | ForEach-Object { ,@($_.ProcessId, $_.ParentProcessId, [double]$_.WorkingSetSize, [double]($_.UserModeTime + $_.KernelModeTime), $(if ($_.CreationDate) { [double]([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } else { 0 })) })} | ConvertTo-Json -Compress -Depth 3";

/**
 * A process as the per-pane sums need it: CPU time in ms since it started, resident memory in bytes
 * (null: not read yet), and when it started (comparable within one table only; absent when unknown).
 */
export interface ProcessRow { pid: number; parent: number; cpuMs: number; rss: number | null; started?: number }
interface ProcessTable { at: number; rows: ProcessRow[]; /** per pid, share of all cores since the previous table, 0–100 */ cpu: Map<number, number> }

interface CpuSample { idle: number; total: number }

function cpuSample(): CpuSample {
  let idle = 0, total = 0;
  for (const cpu of cpus()) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }
  return { idle, total };
}

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

/** Busy share of the time between two samples, 0–100; null when no time passed. */
export function cpuPercent(before: CpuSample, after: CpuSample): number | null {
  const total = after.total - before.total;
  if (total <= 0) return null;
  return Math.round(clampPercent((1 - (after.idle - before.idle) / total) * 100));
}

/**
 * Each process's CPU over the time between two tables, as a share of all `cores`, so a pane's
 * sum sits on the same scale as the PC's line. A process the earlier table did not have counts 0.
 */
// ponytail: a build that starts and ends between two reads never shows; per-pane accounting needs a kernel feed (cgroups, ETW) to see it
export function processCpu(before: ProcessTable | null, rows: readonly ProcessRow[], at: number, cores: number): Map<number, number> {
  const cpu = new Map<number, number>();
  if (!before || at <= before.at || at - before.at > MAX_CPU_GAP_MS || cores <= 0) return cpu;
  const earlier = new Map(before.rows.map((row) => [row.pid, row.cpuMs]));
  const capacity = (at - before.at) * cores;
  for (const row of rows) {
    const previous = earlier.get(row.pid);
    if (previous !== undefined && row.cpuMs >= previous) cpu.set(row.pid, clampPercent(((row.cpuMs - previous) / capacity) * 100));
  }
  return cpu;
}

/**
 * Every process at or below `root`, nearest first; nothing when `root` is not in the table. A child
 * older than its parent is not its child: Windows does not reparent orphans, so they keep naming a
 * pid that a newer process may have been given.
 */
export function processTree(rows: readonly ProcessRow[], root: number): ProcessRow[] {
  const children = new Map<number, ProcessRow[]>();
  for (const row of rows) if (row.pid !== row.parent) children.set(row.parent, [...(children.get(row.parent) ?? []), row]);
  const found = rows.filter((row) => row.pid === root);
  const seen = new Set([root]);
  for (let index = 0; index < found.length; index++) {
    for (const child of children.get(found[index]!.pid) ?? []) {
      const parent = found[index]!;
      if (seen.has(child.pid) || (child.started !== undefined && parent.started !== undefined && child.started < parent.started)) continue;
      seen.add(child.pid);
      found.push(child);
    }
  }
  return found;
}

/** Memory and swap from Linux's /proc/meminfo: MemAvailable, not MemFree, since the page cache gives itself back. */
export function parseMeminfo(text: string): { memory: ResourceMeter | null; swap: ResourceMeter | null } {
  const kb = (key: string): number | null => {
    const match = new RegExp(`^${key}:\\s+(\\d+) kB`, "m").exec(text);
    return match ? Number(match[1]) * 1024 : null;
  };
  const meter = (total: number | null, free: number | null): ResourceMeter | null =>
    total !== null && free !== null && total > 0 ? { used: total - free, total } : null;
  return { memory: meter(kb("MemTotal"), kb("MemAvailable")), swap: meter(kb("SwapTotal"), kb("SwapFree")) };
}

/** A /proc/<pid>/stat line; the command name may hold spaces and parentheses, so fields count from its last `)`. */
export function parseProcStat(pid: number, text: string): ProcessRow | null {
  const fields = text.slice(text.lastIndexOf(")") + 2).split(" ");
  const parent = Number(fields[1]), utime = Number(fields[11]), stime = Number(fields[12]), start = Number(fields[19]);
  if (!Number.isFinite(parent) || !Number.isFinite(utime) || !Number.isFinite(stime)) return null;
  return { pid, parent, cpuMs: (utime + stime) * LINUX_TICK_MS, rss: null, ...(Number.isFinite(start) ? { started: start * LINUX_TICK_MS } : {}) };
}

/** WINDOWS_SCRIPT's answer; null for anything it could not have printed. */
export function parseWindowsTable(text: string): { swap: ResourceMeter | null; rows: ProcessRow[] } | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (value === null || typeof value !== "object") return null;
  const { swap, procs } = value as { swap?: unknown; procs?: unknown };
  const mb = 1024 * 1024;
  const pageFile = Array.isArray(swap) && typeof swap[0] === "number" && typeof swap[1] === "number" && swap[1] > 0 ? { used: swap[0] * mb, total: swap[1] * mb } : null;
  const rows = (Array.isArray(procs) ? procs : []).flatMap((entry): ProcessRow[] => {
    if (!Array.isArray(entry) || entry.length < 4 || entry.length > 5 || !entry.every((item) => typeof item === "number")) return [];
    const [pid, parent, rss, cpu100ns, started] = entry as number[];
    return [{ pid: pid!, parent: parent!, rss: rss!, cpuMs: cpu100ns! / 10_000, ...(started ? { started } : {}) }];
  });
  return { swap: pageFile, rows };
}

async function linuxProcesses(): Promise<ProcessRow[]> {
  const pids = (await readdir("/proc")).filter((name) => /^\d+$/.test(name)).map(Number);
  const rows = await Promise.all(pids.map(async (pid) => {
    try { return parseProcStat(pid, await readFile(`/proc/${pid}/stat`, "utf8")); } catch { return null; }
  }));
  return rows.filter((row): row is ProcessRow => row !== null);
}

async function linuxRss(pid: number): Promise<number> {
  try {
    const match = /^VmRSS:\s+(\d+) kB/m.exec(await readFile(`/proc/${pid}/status`, "utf8"));
    return match ? Number(match[1]) * 1024 : 0;
  } catch { return 0; }
}

interface ProcessInfo { process_info?: { shell_pid?: number } }
async function herdrShellPid(paneId: string): Promise<number | null> {
  try {
    const info = await herdrRpc<ProcessInfo>("pane.process_info", { pane_id: paneId });
    return typeof info.process_info?.shell_pid === "number" ? info.process_info.shell_pid : null;
  } catch { return null; }
}

export interface ResourceOptions {
  platform?: string;
  now?: () => number;
  /** the pane's shell, from herdr's `pane.process_info`; tests pass their own */
  shellPid?: (paneId: string) => Promise<number | null>;
  windowsCommand?: string[];
  windowsTimeoutMs?: number;
}

interface Reading { at: number; pc: Omit<MachineResources, "panes">; table: ProcessTable | null }

/** CPU, memory, swap and disk of this PC, and CPU and memory of the panes asked for, as numbers only. */
export class ResourceService {
  private lastCpu: { at: number; sample: CpuSample } | null = null;
  private reading: Reading | null = null;
  private pendingReading: Promise<Reading> | null = null;
  private linuxTable: ProcessTable | null = null;
  private windows: { at: number; swap: ResourceMeter | null; table: ProcessTable | null } | null = null;
  // one PowerShell at a time: every caller of a slow read shares it
  private pendingWindows: Promise<void> | null = null;
  /** per pane its shell, with the shell's start so a pid handed to a newer process is not mistaken for it; a null pid is "herdr named none" */
  private readonly shells = new Map<string, { pid: number | null; started?: number; at: number }>();
  private readonly pendingShells = new Map<string, Promise<number | null>>();
  private readonly platform: string;
  private readonly now: () => number;

  constructor(private readonly options: ResourceOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.now = options.now ?? Date.now;
  }

  async read(paneIds: readonly string[] = []): Promise<MachineResources> {
    const reading = await this.currentReading();
    const panes = reading.table ? await this.panes(reading.table, paneIds) : [];
    return { ...reading.pc, panes };
  }

  private currentReading(): Promise<Reading> {
    if (this.reading && this.now() - this.reading.at < FRESH_MS) return Promise.resolve(this.reading);
    this.pendingReading ??= this.takeReading().then((reading) => (this.reading = reading)).finally(() => { this.pendingReading = null; });
    return this.pendingReading;
  }

  private async takeReading(): Promise<Reading> {
    const sample = cpuSample();
    const at = this.now();
    // since the last reading; the first one, or one after a long gap, has no "now" to say and says null
    const cpu = this.lastCpu && at - this.lastCpu.at <= MAX_CPU_GAP_MS ? cpuPercent(this.lastCpu.sample, sample) : null;
    this.lastCpu = { at, sample };
    const [memory, disk, table] = await Promise.all([this.memory(), this.disk(), this.processTable()]);
    return { at: this.now(), pc: { cpu, ...memory, disk }, table };
  }

  private async memory(): Promise<{ memory: ResourceMeter | null; swap: ResourceMeter | null }> {
    if (this.platform === "linux") {
      try { return parseMeminfo(await readFile("/proc/meminfo", "utf8")); } catch { /* fall through to os */ }
    }
    const memory = { used: totalmem() - freemem(), total: totalmem() };
    return { memory, swap: this.platform === "win32" ? (await this.windowsTable()).swap : null };
  }

  private async disk(): Promise<ResourceMeter | null> {
    try {
      const stats = await statfs(homedir());
      const total = stats.blocks * stats.bsize;
      return total > 0 ? { used: total - stats.bavail * stats.bsize, total } : null;
    } catch { return null; }
  }

  private async processTable(): Promise<ProcessTable | null> {
    if (this.platform === "win32") return (await this.windowsTable()).table;
    if (this.platform !== "linux") return null;
    try {
      const rows = await linuxProcesses();
      const at = this.now();
      this.linuxTable = { at, rows, cpu: processCpu(this.linuxTable, rows, at, cpus().length) };
      return this.linuxTable;
    } catch { return null; }
  }

  /** The last Windows read while it is fresh; a stale one is answered at once while a new read runs. */
  async windowsTable(): Promise<{ swap: ResourceMeter | null; table: ProcessTable | null }> {
    const cached = this.windows;
    if (cached && this.now() - cached.at < WINDOWS_TABLE_MS) return cached;
    this.pendingWindows ??= this.readWindows().finally(() => { this.pendingWindows = null; });
    if (cached) return cached;
    await this.pendingWindows;
    return this.windows ?? { swap: null, table: null };
  }

  private async readWindows(): Promise<void> {
    const command = this.options.windowsCommand ?? ["powershell", "-NoProfile", "-NonInteractive", "-Command", WINDOWS_SCRIPT];
    let parsed: ReturnType<typeof parseWindowsTable> = null;
    try {
      const probe = Bun.spawn(command, { windowsHide: true, stdin: "ignore", stdout: "pipe", stderr: "ignore", timeout: this.options.windowsTimeoutMs ?? WINDOWS_TIMEOUT_MS, killSignal: "SIGKILL" });
      const [code, out] = await Promise.all([probe.exited, new Response(probe.stdout).text()]);
      if (code === 0) parsed = parseWindowsTable(out);
    } catch { /* answered as unknown below */ }
    const at = this.now();
    const table = parsed && parsed.rows.length > 0 ? { at, rows: parsed.rows, cpu: processCpu(this.windows?.table ?? null, parsed.rows, at, cpus().length) } : null;
    this.windows = { at, swap: parsed?.swap ?? null, table };
  }

  private async shellPid(paneId: string, table: ProcessTable): Promise<number | null> {
    const known = this.shells.get(paneId);
    if (known?.pid === null && this.now() - known.at < NO_SHELL_MS) return null;
    // a shell that left the table (or whose pid a newer process now holds) belonged to a pane that restarted: ask herdr again
    if (known && known.pid !== null && table.rows.some((row) => row.pid === known.pid && row.started === known.started)) return known.pid;
    // two clients asking at once share the one RPC
    let pending = this.pendingShells.get(paneId);
    if (!pending) {
      pending = (this.options.shellPid ?? herdrShellPid)(paneId).then((pid) => {
        this.shells.set(paneId, { pid, started: table.rows.find((row) => row.pid === pid)?.started, at: this.now() });
        return pid;
      }).finally(() => this.pendingShells.delete(paneId));
      this.pendingShells.set(paneId, pending);
    }
    return pending;
  }

  private async panes(table: ProcessTable, paneIds: readonly string[]): Promise<PaneResources[]> {
    const ids = [...new Set(paneIds)].filter((id) => PANE_ID.test(id)).slice(0, MAX_PANES);
    const answers = await Promise.all(ids.map(async (paneId): Promise<PaneResources | null> => {
      const pid = await this.shellPid(paneId, table);
      if (pid === null) return null;
      const tree = processTree(table.rows, pid);
      if (tree.length === 0) return null;
      const memory = (await Promise.all(tree.map((row) => row.rss ?? linuxRss(row.pid)))).reduce((sum, rss) => sum + rss, 0);
      const cpu = tree.some((row) => table.cpu.has(row.pid)) ? Math.round(tree.reduce((sum, row) => sum + (table.cpu.get(row.pid) ?? 0), 0)) : null;
      return { pane_id: paneId, cpu, memory };
    }));
    return answers.filter((answer): answer is PaneResources => answer !== null);
  }
}

/** `?panes=a,b`: the panes the client draws, whose shells' process trees are summed. */
export async function handleResourcesRequest(request: Request, url: URL, resources: ResourceService): Promise<Response> {
  if (request.method !== "GET") return jsonResponse({ error: { code: "method_not_allowed", message: "Use GET /api/system/resources" } }, 405, { allow: "GET" });
  const panes = (url.searchParams.get("panes") ?? "").split(",").filter(Boolean);
  return jsonResponse(await resources.read(panes), 200, { "cache-control": "no-store" });
}
