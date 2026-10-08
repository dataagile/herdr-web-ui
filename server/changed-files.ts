/**
 * The files a pane's agent changed in its session, for the header's "modified files" panel.
 *
 * Two sources, neither trusted for the other's job: the agent's own transcript says which files
 * ITS calls changed (and how, call by call), git says what is different on disk now. A file only
 * git shows may be someone else's change, so it is listed apart. Read-only: nothing here writes,
 * and no file's content is read except through `git diff` for a path the list itself named.
 */

import { realpathSync, statSync } from "node:fs";
import nodePath from "node:path";

import { fileChanges, type ChangeBody } from "../shared/file-changes.ts";
import { patchText } from "../shared/patch.ts";
import { carriesPatch } from "../shared/tool-verbs.ts";
import type { ChangedFile, ChangedFileDiff, ChangedFilesResponse, ConversationTurn, SessionChangedFile } from "../shared/protocol.ts";
import { ConversationUnavailable, paneWholeConversation } from "./conversation.ts";
import { HerdrError, sessionSnapshot } from "./herdr/client.ts";

/** What one file's calls added up to, before it meets the disk and git. */
export interface SessionFileEdits {
  path: string;
  /** the file did not exist before the session's first call on it; null when a whole-file write leaves that unknown (git's letter decides) */
  created: boolean | null;
  /** a Codex script that applies a patch failed as a whole: its patch may or may not have landed */
  uncertain?: boolean;
  last_at: string | null;
  edits: { at: string | null; body: ChangeBody }[];
}

/**
 * Walks a conversation's turns and gathers, per file, the calls that changed it. A call that
 * failed changed nothing, except a Codex exec script that applies a patch: the script can fail
 * after the patch landed and the result does not say which, so its edits are kept and marked
 * uncertain. A relative path resolves against the folder the call ran in when the transcript
 * records it, else against `cwd`.
 */
export function sessionEdits(turns: readonly ConversationTurn[], cwd: string, path: typeof nodePath = nodePath): Map<string, SessionFileEdits> {
  const files = new Map<string, SessionFileEdits>();
  for (const turn of turns) {
    if (turn.role !== "assistant") continue;
    for (const part of turn.parts) {
      if (part.kind !== "tool") continue;
      const script = part.error === true && !/^(apply_patch|patch)$/i.test(part.name) && carriesPatch(part.name) && patchText(part.input) !== null && !/apply_patch verification failed/.test(part.output);
      if (part.error && !script) continue;
      for (const change of fileChanges(part.name, part.input)) {
        const absolute = path.resolve(part.cwd ?? cwd, change.path);
        let file = files.get(absolute);
        if (file === undefined) {
          const made = change.created || (change.whole === true && /File created successfully/.test(part.output));
          file = { path: absolute, created: made ? true : change.whole === true && !/has been updated/.test(part.output) ? null : false, last_at: null, edits: [] };
          files.set(absolute, file);
        }
        if (script) file.uncertain = true;
        file.edits.push({ at: turn.ts, body: change.body });
        file.last_at = turn.end_ts ?? turn.ts ?? file.last_at;
      }
    }
  }
  return files;
}

/** git status's letters for a porcelain v1 XY pair. */
export function gitLetter(xy: string): NonNullable<ChangedFile["git"]> | null {
  if (xy === "!!") return null;
  if (xy === "??") return "?";
  if (xy.includes("D")) return "D";
  if (xy.includes("R")) return "R";
  if (xy.includes("A") || xy.includes("C")) return "A";
  return "M";
}

/** `git status --porcelain=v1 -z`: the paths are relative to the repo's root; a rename is followed by the name it left. */
export function parsePorcelain(output: string): { path: string; status: NonNullable<ChangedFile["git"]> }[] {
  const fields = output.split("\0");
  const changes: { path: string; status: NonNullable<ChangedFile["git"]> }[] = [];
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index]!;
    if (field.length < 4) continue;
    const xy = field.slice(0, 2);
    if (xy.includes("R") || xy.includes("C")) index++;
    const status = gitLetter(xy);
    if (status !== null) changes.push({ path: field.slice(3), status });
  }
  return changes;
}

const GIT_TIMEOUT_MS = 5_000;
/** git status is a list of names; the repo with more changed files than this is not a list worth drawing. */
const GIT_STATUS_MAX_BYTES = 1024 * 1024;
export const DIFF_MAX_BYTES = 512 * 1024;
/** no external diff driver, no textconv program: only git's own diff reads the file */
export const DIFF_FLAGS = ["--no-color", "--no-ext-diff", "--no-textconv"];
/**
 * core.fsmonitor can name a program to run on every status, so it is forced off, and the diffs run
 * with --no-ext-diff / --no-textconv (DIFF_FLAGS). This is not a sandbox: clean filters and other
 * config in the user's own repo can still run on status / diff, as they do whenever git runs there.
 */
export const GIT_SAFE = ["-c", "core.fsmonitor=false", "-c", "core.quotepath=off"];

/** git, run without a shell, with a deadline and a cap on what is read; null when it cannot run or times out. */
async function git(cwd: string, args: string[], maxBytes = GIT_STATUS_MAX_BYTES): Promise<{ code: number; out: string; truncated: boolean } | null> {
  let child: ReturnType<typeof Bun.spawn>;
  try {
    child = Bun.spawn(["git", "-C", cwd, ...GIT_SAFE, ...args], {
      stdin: "ignore", stdout: "pipe", stderr: "ignore",
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
    });
  } catch { return null; }
  const timer = setTimeout(() => child.kill(), GIT_TIMEOUT_MS);
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    let truncated = false;
    const reader = (child.stdout as ReadableStream<Uint8Array>).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      chunks.push(size > maxBytes ? value.subarray(0, value.length - (size - maxBytes)) : value);
      if (size > maxBytes) { truncated = true; child.kill(); break; }
    }
    const code = truncated ? 0 : await child.exited;
    return { code, out: Buffer.concat(chunks).toString("utf8"), truncated };
  } catch { return null; } finally { clearTimeout(timer); }
}

/** Where the pane's repo starts and what git sees changed in it; null outside a work tree. */
export async function gitChanges(cwd: string, maxBytes = GIT_STATUS_MAX_BYTES): Promise<{ root: string; changes: { path: string; status: NonNullable<ChangedFile["git"]> }[]; truncated: boolean; fingerprint: string } | null> {
  const top = await git(cwd, ["rev-parse", "--show-toplevel"]);
  if (top === null || top.code !== 0 || top.out.trim().length === 0) return null;
  const status = await git(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames"], maxBytes);
  if (status === null || status.code !== 0) return null;
  const root = top.out.trim();
  // a cut list is not a list: the last name may be half of one, and the rest are missing
  if (status.truncated) return { root, changes: [], truncated: true, fingerprint: "truncated" };
  return { root, truncated: false, fingerprint: status.out, changes: parsePorcelain(status.out).map((change) => ({ ...change, path: nodePath.resolve(root, change.path) })) };
}

function realOrSelf(path: string): { path: string; exists: boolean } {
  try { return { path: realpathSync(path), exists: true }; } catch { return { path, exists: false }; }
}

/** `path` relative to the first of the folders it is inside (the pane's folder as named, then as the disk has it), else itself. */
function locate(path: string, ...folders: string[]): { path: string; rel: string } {
  for (const folder of folders) {
    const rel = nodePath.relative(folder, path);
    if (rel.length > 0 && !rel.startsWith("..") && !nodePath.isAbsolute(rel)) return { path, rel: rel.split(nodePath.sep).join("/") };
  }
  return { path, rel: path };
}

/** What a transcript's calls added up to, and whether its session was cut at the page limit. */
export interface SessionRead { files: Map<string, SessionFileEdits>; truncated: boolean; pages: number }

/** Per transcript file and size: the turns of a long session are read once, not on every poll. */
const sessionCache = new Map<string, { signature: string; cwd: string; result: Promise<SessionRead> }>();

/** The session's edits for a transcript in this state; `read` parses the turns only when the file or the folder changed. */
export function cachedSessionEdits(path: string, signature: string, cwd: string, read: () => Promise<{ turns: ConversationTurn[]; truncated: boolean; pages: number }>): Promise<SessionRead> {
  const cached = sessionCache.get(path);
  if (cached !== undefined && cached.signature === signature && cached.cwd === cwd) return cached.result;
  const result = read().then((whole) => ({ files: sessionEdits(whole.turns, cwd), truncated: whole.truncated, pages: whole.pages }));
  sessionCache.delete(path);
  const entry = { signature, cwd, result };
  sessionCache.set(path, entry);
  // a read that failed is not kept: the next poll asks again
  result.catch(() => { if (sessionCache.get(path) === entry) sessionCache.delete(path); });
  if (sessionCache.size > 16) sessionCache.delete(sessionCache.keys().next().value!);
  return result;
}

export interface PaneChanges {
  report: ChangedFilesResponse;
  /** the transcript's calls, by absolute path */
  edits: Map<string, SessionFileEdits>;
  root: string | null;
}

/** The last report per pane, kept while neither its transcript, its folder nor git's status changed: a /diff asked right after the list does not rebuild it. */
const reportCache = new Map<string, { key: string; changes: PaneChanges; at: number }>();
/** A /diff asked this soon after the list reuses it; the panel refreshes the list every 15 s. */
const REPORT_REUSE_MS = 30_000;

/** Forgets what was read from transcripts (tests). */
export function forgetChangedFiles(): void { sessionCache.clear(); reportCache.clear(); }

export async function paneChanges(paneId: string, codexHome?: string): Promise<PaneChanges> {
  // one snapshot answers the pane's folder and the transcript's lookup
  const snapshot = await sessionSnapshot();
  // an unknown pane is an error, as it is for every pane route; a pane with no agent is an empty session
  let cwd = paneFolder(snapshot, paneId);
  let edits = new Map<string, SessionFileEdits>();
  let session: SessionRead | null = null;
  let signature = "none";
  try {
    const whole = await paneWholeConversation(paneId, codexHome, snapshot);
    cwd = whole.cwd;
    signature = `${whole.path}:${whole.signature}`;
    session = await cachedSessionEdits(whole.path, whole.signature, whole.cwd, whole.read);
    edits = session.files;
  } catch (error) {
    // a pane with no recognized agent has no session to list; its git changes still stand.
    // Anything else (a herdr timeout, a transcript that cannot be read) must not take the git list with it.
    if (!(error instanceof ConversationUnavailable)) console.error(`changed-files: session of pane ${paneId} not read: ${error instanceof Error ? error.message : String(error)}`);
  }
  const repo = await gitChanges(cwd);
  // a file the session edited can appear or vanish without the transcript or git's status moving (an ignored file, a rm
  // outside git): its mtime, or its absence, is part of the key, so `exists` is never older than the last poll
  const onDisk = [...edits.keys()].map((path) => { try { return statSync(path).mtimeMs; } catch { return "-"; } }).join(",");
  const key = `${signature}\0${cwd}\0${repo?.root ?? ""}\0${repo?.fingerprint ?? ""}\0${onDisk}`;
  const cached = reportCache.get(paneId);
  if (cached !== undefined && cached.key === key) { cached.at = Date.now(); return cached.changes; }

  // each path meets the disk once
  const real = new Map<string, { path: string; exists: boolean }>();
  const disk = (path: string): { path: string; exists: boolean } => {
    let found = real.get(path);
    if (found === undefined) { found = realOrSelf(path); real.set(path, found); }
    return found;
  };
  const letters = new Map<string, NonNullable<ChangedFile["git"]>>();
  for (const change of repo?.changes ?? []) letters.set(disk(change.path).path, change.status);

  // the pane's folder may be a symlink: git names paths by the real one
  const folders = [cwd, disk(cwd).path];
  const listed = new Set<string>();
  const sessionFiles: SessionChangedFile[] = [...edits.values()].map((file) => {
    const onDisk = disk(file.path);
    listed.add(onDisk.path);
    const letter = letters.get(onDisk.path);
    return {
      ...locate(file.path, ...folders), exists: onDisk.exists, edits: file.edits.length,
      // a whole-file write the transcript cannot place: git says whether the file is new
      created: file.created ?? (letter === "?" || letter === "A"), last_at: file.last_at,
      ...(file.uncertain === true ? { uncertain: true } : {}),
      ...(letter === undefined ? {} : { git: letter }),
    };
  });
  const git = (repo?.changes ?? []).filter((change) => !listed.has(disk(change.path).path)).map((change) => ({
    ...locate(change.path, ...folders), exists: change.status !== "D", git: change.status,
  }));
  sessionFiles.sort((left, right) => (right.last_at ?? "").localeCompare(left.last_at ?? ""));
  const changes: PaneChanges = {
    report: {
      session: sessionFiles, git, repo: repo !== null, ...(repo?.truncated ? { gitTruncated: true } : {}),
      ...(session?.truncated ? { sessionTruncated: true, sessionParts: session.pages } : {}),
    },
    edits, root: repo?.root ?? null,
  };
  reportCache.delete(paneId);
  reportCache.set(paneId, { key, changes, at: Date.now() });
  if (reportCache.size > 32) reportCache.delete(reportCache.keys().next().value!);
  return changes;
}

/** The folder the files dialog opens at: the pane's foreground process's, else the pane's. */
function paneFolder(snapshot: Awaited<ReturnType<typeof sessionSnapshot>>, paneId: string): string {
  const pane = snapshot.panes.find((candidate) => candidate.pane_id === paneId);
  if (!pane) throw new HerdrError("pane_not_found", `pane ${paneId} not found`);
  const cwd = pane.foreground_cwd ?? pane.cwd;
  if (!cwd) throw new HerdrError("cwd_not_found", `pane ${paneId} has no working directory`);
  return cwd;
}

/**
 * One file's diff without rebuilding the report the list just built: the pane's cached report is
 * used while it is recent. A path it does not name may be a change made since, so then (and only
 * then) the report is built again before the path is refused.
 */
export async function paneFileDiff(paneId: string, path: string, codexHome?: string): Promise<ChangedFileDiff> {
  const cached = reportCache.get(paneId);
  if (cached !== undefined && Date.now() - cached.at < REPORT_REUSE_MS) {
    try { return await changedFileDiff(cached.changes, path); } catch (error) { if (!(error instanceof ChangedFileNotListed)) throw error; }
  }
  return changedFileDiff(await paneChanges(paneId, codexHome), path);
}

export class ChangedFileNotListed extends Error {
  constructor() { super("this path is not among the pane's changed files"); this.name = "ChangedFileNotListed"; }
}

/**
 * The diff of one file the list named: the session's calls for a file it changed, git's for the
 * rest. A path the list did not name is refused, so the route cannot be asked to read any file.
 */
export async function changedFileDiff(changes: PaneChanges, path: string): Promise<ChangedFileDiff> {
  const edits = changes.edits.get(path);
  if (edits !== undefined) {
    return { kind: "session", path, edits: edits.edits };
  }
  const entry = changes.report.git.find((file) => file.path === path);
  if (entry === undefined || changes.root === null) throw new ChangedFileNotListed();
  const target = nodePath.relative(changes.root, path).split(nodePath.sep).join("/");
  const flags = DIFF_FLAGS;
  // git has no diff for a file it does not track: compare it with nothing (exit 1 means "differs")
  let out = entry.git === "?"
    ? await git(changes.root, ["diff", "--no-index", ...flags, "--", process.platform === "win32" ? "NUL" : "/dev/null", path], DIFF_MAX_BYTES)
    : await git(changes.root, ["diff", "HEAD", ...flags, "--", target], DIFF_MAX_BYTES);
  // a repo with no commit yet has no HEAD to compare with: the index stands in
  if (entry.git !== "?" && (out === null || out.code !== 0)) out = await git(changes.root, ["diff", ...flags, "--", target], DIFF_MAX_BYTES);
  return { kind: "git", path, diff: out?.out ?? "", truncated: out?.truncated ?? false };
}
