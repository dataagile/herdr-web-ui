/**
 * The files a pane's agent changed in its session, for the header's "modified files" panel.
 *
 * Two sources, neither trusted for the other's job: the agent's own transcript says which files
 * ITS calls changed (and how, call by call), git says what is different on disk now. A file only
 * git shows may be someone else's change, so it is listed apart. Read-only: nothing here writes,
 * and no file's content is read except through `git diff` for a path the list itself named.
 */

import { realpathSync } from "node:fs";
import nodePath from "node:path";

import { fileChanges, type ChangeBody } from "../shared/file-changes.ts";
import type { ChangedFile, ChangedFileDiff, ChangedFilesResponse, ConversationTurn, SessionChangedFile } from "../shared/protocol.ts";
import { ConversationUnavailable, paneWholeConversation } from "./conversation.ts";
import { HerdrError, sessionSnapshot } from "./herdr/client.ts";

/** What one file's calls added up to, before it meets the disk and git. */
export interface SessionFileEdits {
  path: string;
  created: boolean;
  last_at: string | null;
  edits: { at: string | null; body: ChangeBody }[];
}

/**
 * Walks a conversation's turns and gathers, per file, the calls that changed it. A call that
 * failed changed nothing. Relative paths are the agent's: they resolve against `cwd`.
 */
export function sessionEdits(turns: readonly ConversationTurn[], cwd: string, path: typeof nodePath = nodePath): Map<string, SessionFileEdits> {
  const files = new Map<string, SessionFileEdits>();
  for (const turn of turns) {
    if (turn.role !== "assistant") continue;
    for (const part of turn.parts) {
      if (part.kind !== "tool" || part.error) continue;
      for (const change of fileChanges(part.name, part.input)) {
        const absolute = path.resolve(cwd, change.path);
        let file = files.get(absolute);
        if (file === undefined) {
          file = { path: absolute, created: change.created, last_at: null, edits: [] };
          files.set(absolute, file);
        }
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
/** Config git would otherwise run programs from (a filesystem monitor, a diff driver) stays off. */
const GIT_SAFE = ["-c", "core.fsmonitor=false", "-c", "core.quotepath=off"];

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
export async function gitChanges(cwd: string): Promise<{ root: string; changes: { path: string; status: NonNullable<ChangedFile["git"]> }[] } | null> {
  const top = await git(cwd, ["rev-parse", "--show-toplevel"]);
  if (top === null || top.code !== 0 || top.out.trim().length === 0) return null;
  const status = await git(cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames"]);
  if (status === null || status.code !== 0) return null;
  const root = top.out.trim();
  return { root, changes: parsePorcelain(status.out).map((change) => ({ ...change, path: nodePath.resolve(root, change.path) })) };
}

function realOrSelf(path: string): { path: string; exists: boolean } {
  try { return { path: realpathSync(path), exists: true }; } catch { return { path, exists: false }; }
}

function locate(path: string, cwd: string): { path: string; rel: string } {
  const rel = nodePath.relative(cwd, path);
  return { path, rel: rel.length > 0 && !rel.startsWith("..") && !nodePath.isAbsolute(rel) ? rel.split(nodePath.sep).join("/") : path };
}

/** Per transcript file and size: the turns of a long session are read once, not on every poll. */
const sessionCache = new Map<string, { signature: string; cwd: string; files: Map<string, SessionFileEdits> }>();

/** The session's edits for a transcript in this state; `read` parses the turns only when the file or the folder changed. */
export function cachedSessionEdits(path: string, signature: string, cwd: string, read: () => ConversationTurn[]): Map<string, SessionFileEdits> {
  const cached = sessionCache.get(path);
  if (cached !== undefined && cached.signature === signature && cached.cwd === cwd) return cached.files;
  const files = sessionEdits(read(), cwd);
  sessionCache.delete(path);
  sessionCache.set(path, { signature, cwd, files });
  if (sessionCache.size > 16) sessionCache.delete(sessionCache.keys().next().value!);
  return files;
}

export interface PaneChanges {
  report: ChangedFilesResponse;
  /** the transcript's calls, by absolute path */
  edits: Map<string, SessionFileEdits>;
  root: string | null;
}

/** Forgets what was read from transcripts (tests). */
export function forgetChangedFiles(): void { sessionCache.clear(); }

export async function paneChanges(paneId: string, codexHome?: string): Promise<PaneChanges> {
  // an unknown pane is an error, as it is for every pane route; a pane with no agent is an empty session
  let cwd = await paneFolder(paneId);
  let edits = new Map<string, SessionFileEdits>();
  try {
    const whole = await paneWholeConversation(paneId, codexHome);
    cwd = whole.cwd;
    edits = cachedSessionEdits(whole.path, whole.signature, whole.cwd, whole.read);
  } catch (error) {
    // a pane with no recognized agent has no session to list; its git changes still stand
    if (!(error instanceof ConversationUnavailable)) throw error;
  }
  const repo = await gitChanges(cwd);
  const letters = new Map<string, NonNullable<ChangedFile["git"]>>();
  for (const change of repo?.changes ?? []) letters.set(realOrSelf(change.path).path, change.status);

  const listed = new Set<string>();
  const session: SessionChangedFile[] = [...edits.values()].map((file) => {
    const disk = realOrSelf(file.path);
    listed.add(disk.path);
    const letter = letters.get(disk.path);
    return {
      ...locate(file.path, cwd), exists: disk.exists, edits: file.edits.length, created: file.created, last_at: file.last_at,
      ...(letter === undefined ? {} : { git: letter }),
    };
  });
  const git = (repo?.changes ?? []).filter((change) => !listed.has(realOrSelf(change.path).path)).map((change) => ({
    ...locate(change.path, cwd), exists: change.status !== "D", git: change.status,
  }));
  session.sort((left, right) => (right.last_at ?? "").localeCompare(left.last_at ?? ""));
  return { report: { session, git, repo: repo !== null }, edits, root: repo?.root ?? null };
}

/** The folder the files dialog opens at: the pane's foreground process's, else the pane's. */
async function paneFolder(paneId: string): Promise<string> {
  const pane = (await sessionSnapshot()).panes.find((candidate) => candidate.pane_id === paneId);
  if (!pane) throw new HerdrError("pane_not_found", `pane ${paneId} not found`);
  const cwd = pane.foreground_cwd ?? pane.cwd;
  if (!cwd) throw new HerdrError("cwd_not_found", `pane ${paneId} has no working directory`);
  return cwd;
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
  if (edits !== undefined && changes.report.session.some((file) => file.path === path)) {
    return { kind: "session", path, edits: edits.edits };
  }
  const entry = changes.report.git.find((file) => file.path === path);
  if (entry === undefined || changes.root === null) throw new ChangedFileNotListed();
  const target = nodePath.relative(changes.root, path).split(nodePath.sep).join("/");
  const flags = ["--no-color", "--no-ext-diff", "--no-textconv"];
  // git has no diff for a file it does not track: compare it with nothing (exit 1 means "differs")
  let out = entry.git === "?"
    ? await git(changes.root, ["diff", "--no-index", ...flags, "--", process.platform === "win32" ? "NUL" : "/dev/null", path], DIFF_MAX_BYTES)
    : await git(changes.root, ["diff", "HEAD", ...flags, "--", target], DIFF_MAX_BYTES);
  // a repo with no commit yet has no HEAD to compare with: the index stands in
  if (entry.git !== "?" && (out === null || out.code !== 0)) out = await git(changes.root, ["diff", ...flags, "--", target], DIFF_MAX_BYTES);
  return { kind: "git", path, diff: out?.out ?? "", truncated: out?.truncated ?? false };
}
