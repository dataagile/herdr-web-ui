import { afterAll, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createServer } from "./index.ts";
import { cpuPercent, parseMeminfo, parseProcStat, parseWindowsTable, processCpu, processTree, ResourceService, type ProcessRow } from "./resources.ts";

const root = mkdtempSync(join(tmpdir(), "herdr-resources-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const row = (pid: number, parent: number, cpuMs = 0, rss: number | null = 0): ProcessRow => ({ pid, parent, cpuMs, rss });

describe("resource parsers", () => {
  it("reads MemAvailable rather than MemFree, and swap", () => {
    const text = "MemTotal:        8000 kB\nMemFree:          800 kB\nMemAvailable:    3000 kB\nSwapTotal:       4000 kB\nSwapFree:        3000 kB\n";
    expect(parseMeminfo(text)).toEqual({ memory: { used: 5000 * 1024, total: 8000 * 1024 }, swap: { used: 1000 * 1024, total: 4000 * 1024 } });
    // no swap configured is no meter, not 0 of 0
    expect(parseMeminfo("MemTotal: 8000 kB\nMemAvailable: 3000 kB\nSwapTotal: 0 kB\nSwapFree: 0 kB\n").swap).toBeNull();
  });

  it("counts /proc stat fields from the command name's last parenthesis", () => {
    const line = "42 (tmux: (server) x) S 7 42 42 0 -1 4194560 100 0 0 0 250 50 0 0 20 0 1 0 100 1000 200";
    expect(parseProcStat(42, line)).toEqual({ pid: 42, parent: 7, cpuMs: 3000, rss: null, started: 1000 });
  });

  it("reads the Windows script's numbers and drops anything else", () => {
    const text = JSON.stringify({ swap: [512, 2048], procs: [[4, 0, 1048576, 20_000_000], [8, 4, "x", 1], [9, 4]] });
    expect(parseWindowsTable(text)).toEqual({ swap: { used: 512 * 1048576, total: 2048 * 1048576 }, rows: [{ pid: 4, parent: 0, rss: 1048576, cpuMs: 2000 }] });
    // the start, when Windows gives one
    expect(parseWindowsTable(JSON.stringify({ swap: [0, 0], procs: [[4, 0, 0, 0, 1700000000000], [5, 4, 0, 0, 0]] }))?.rows).toEqual([
      { pid: 4, parent: 0, rss: 0, cpuMs: 0, started: 1700000000000 }, { pid: 5, parent: 4, rss: 0, cpuMs: 0 },
    ]);
    expect(parseWindowsTable("not json")).toBeNull();
    expect(parseWindowsTable(JSON.stringify({ swap: [0, 0], procs: [] }))?.swap).toBeNull();
  });

  it("gives the PC's busy share between two samples", () => {
    expect(cpuPercent({ idle: 100, total: 200 }, { idle: 150, total: 400 })).toBe(75);
    expect(cpuPercent({ idle: 100, total: 200 }, { idle: 100, total: 200 })).toBeNull();
  });

  it("puts each process's CPU on the scale of all cores", () => {
    const before = { at: 0, rows: [row(1, 0, 1000), row(2, 1, 0)], cpu: new Map() };
    // 1 s on 4 cores: 2 s of CPU is half the PC, a process born since counts nothing
    const cpu = processCpu(before, [row(1, 0, 3000), row(2, 1, 400), row(3, 1, 900)], 1000, 4);
    expect(cpu.get(1)).toBe(50);
    expect(cpu.get(2)).toBe(10);
    expect(cpu.has(3)).toBe(false);
    expect(processCpu(null, [row(1, 0)], 1000, 4).size).toBe(0);
    // after a long gap (a page hidden for a while) the average says nothing about now
    expect(processCpu(before, [row(1, 0, 3000)], 60_000, 4).size).toBe(0);
    // Windows' tables are 10–25 s apart on a busy PC: that is still "now" there
    expect(processCpu(before, [row(1, 0, 3000)], 24_000, 4, 25_000).get(1)).toBeCloseTo(2.08, 1);
  });

  it("walks a shell's descendants and nothing beside it", () => {
    const rows = [row(1, 0), row(10, 1), row(11, 10), row(12, 11), row(20, 1), row(13, 10)];
    expect(processTree(rows, 10).map((r) => r.pid)).toEqual([10, 11, 13, 12]);
    expect(processTree(rows, 99)).toEqual([]);
    // Windows keeps an orphan's parent pid: one older than the shell that now holds that pid is not its child
    const reused = [{ ...row(10, 1), started: 500 }, { ...row(11, 10), started: 100 }, { ...row(12, 10), started: 600 }];
    expect(processTree(reused, 10).map((r) => r.pid)).toEqual([10, 12]);
  });
});

describe("ResourceService", () => {
  it.if(process.platform === "linux")("sums this test's own process tree on Linux", async () => {
    let now = 0;
    const service = new ResourceService({ now: () => now, shellPid: async (pane) => (pane === "p1" ? process.pid : null) });
    const first = await service.read(["p1", "gone"]);
    // the first reading has nothing to compare with
    expect(first.cpu).toBeNull();
    expect(first.memory!.total).toBeGreaterThan(0);
    expect(first.disk!.total).toBeGreaterThan(0);
    expect(first.panes).toEqual([{ pane_id: "p1", cpu: null, memory: expect.any(Number) }]);
    expect(first.panes[0]!.memory).toBeGreaterThan(1024 * 1024);
    now += 2_500;
    const second = await service.read(["p1"]);
    expect(second.cpu).toEqual(expect.any(Number));
    expect(second.panes[0]!.cpu).toEqual(expect.any(Number));
  });

  it("serves every client within 2 s from one reading", async () => {
    let asked = 0;
    const service = new ResourceService({ platform: "linux", now: () => 0, shellPid: async () => { asked++; return process.pid; } });
    await Promise.all([service.read(), service.read(), service.read()]);
    const [a, b] = await Promise.all([service.read(["p"]), service.read(["p"])]);
    expect(a.cpu).toBe(b.cpu);
    // the pane's shell is asked for once and kept while it is in the table
    if (process.platform === "linux") expect(asked).toBe(1);
  });

  it("asks herdr again for a pane with no shell only after a while", async () => {
    let now = 0, asked = 0;
    const service = new ResourceService({ platform: "linux", now: () => now, shellPid: async () => { asked++; return null; } });
    await service.read(["p"]);
    now += 2_500;
    await service.read(["p"]);
    expect(asked).toBe(1);
    now += 10_000;
    await service.read(["p"]);
    expect(asked).toBe(2);
  });

  it("refuses pane IDs that are not IDs and caps how many", async () => {
    const asked: string[] = [];
    const service = new ResourceService({ platform: "linux", shellPid: async (pane) => { asked.push(pane); return null; } });
    await service.read(["ok-1", "../etc", "a b", ...Array.from({ length: 300 }, (_, i) => `p${i}`)]);
    expect(asked).not.toContain("../etc");
    expect(asked).not.toContain("a b");
    expect(asked.length).toBe(200);
  });

  it("runs one PowerShell at a time on Windows, however many ask", async () => {
    const log = join(root, "spawns.log");
    const script = JSON.stringify({ swap: [10, 100], procs: [[1, 0, 2048, 0]] });
    const service = new ResourceService({ platform: "win32", windowsCommand: ["sh", "-c", `echo x >> ${log}; sleep 0.3; echo '${script}'`] });
    const answers = await Promise.all([service.windowsTable(), service.windowsTable(), service.windowsTable()]);
    expect(readFileSync(log, "utf8").trim().split("\n")).toHaveLength(1);
    expect(answers.every((answer) => answer.swap?.total === 100 * 1024 * 1024)).toBe(true);
    // fresh for 10 s: nothing new runs
    await service.windowsTable();
    expect(readFileSync(log, "utf8").trim().split("\n")).toHaveLength(1);
  });

  it("keeps a Windows process's CPU across tables 22 s apart, as a busy PC spaces them", async () => {
    const counter = join(root, "tables.count");
    let now = 0;
    const service = new ResourceService({ platform: "win32", now: () => now, windowsCommand: ["sh", "-c", `n=$(cat ${counter} 2>/dev/null || echo 0); n=$((n+1)); echo $n > ${counter}; echo "{\\"swap\\":[0,0],\\"procs\\":[[1,0,0,$((n*10000000))]]}"`] });
    await service.windowsTable();
    now = 22_000;
    await service.windowsTable(); // stale: answered at once while the next table is read
    while ((service as unknown as { pendingWindows: Promise<void> | null }).pendingWindows) await (service as unknown as { pendingWindows: Promise<void> }).pendingWindows;
    expect((await service.windowsTable()).table?.cpu.has(1)).toBe(true);
  });

  it("gives up on a PowerShell that stalls, within its deadline", async () => {
    const service = new ResourceService({ platform: "win32", windowsCommand: ["sleep", "5"], windowsTimeoutMs: 200 });
    const started = performance.now();
    expect(await service.windowsTable()).toMatchObject({ swap: null, table: null });
    expect(performance.now() - started).toBeLessThan(3_000);
  });
});

describe("GET /api/system/resources", () => {
  const service = new ResourceService({ platform: "linux", shellPid: async (pane) => (pane === "p1" ? process.pid : null) });
  const server = createServer({ port: 0, stateDir: mkdtempSync(join(root, "state-")), token: "resources-token", resources: service });
  const url = `http://localhost:${server.port}/api/system/resources?panes=p1`;
  afterAll(() => server.stop());

  it("needs the token like every other route", async () => {
    expect((await fetch(url)).status).toBe(401);
    expect((await fetch(url.replace("/api/", "/api/machines/local/"))).status).toBe(401);
  });

  it("answers numbers and the pane IDs asked for, nothing else", async () => {
    const response = await fetch(url, { headers: { authorization: "Bearer resources-token" } });
    expect(response.status).toBe(200);
    const strings: string[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === "string") strings.push(value);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    walk(await response.json());
    expect(strings.every((value) => value === "p1")).toBe(true);
  });

  it("answers GET only", async () => {
    const response = await fetch(url, { method: "POST", headers: { authorization: "Bearer resources-token", origin: `http://localhost:${server.port}` } });
    expect(response.status).toBe(405);
  });
});
