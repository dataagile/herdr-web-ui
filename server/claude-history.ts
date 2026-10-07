/**
 * The Claude Code sessions that ran in a folder, from the transcripts in the config dir
 * (`<config dir>/projects/<project>/<session>.jsonl`, see claude-store.ts). Read only: nothing is
 * written, and the client's folder is only ever compared with the `cwd` a transcript records, never
 * opened.
 *
 * Transcripts reach tens of MB, so a listing reads as little as it can: the files are filtered by
 * mtime from the directory listing (in the project directories named for the folders first), each
 * candidate is read at its head (folder, first prompt) and its tail (a /rename lands at the end),
 * and what needs the whole file (the prompt count, a /rename mid-file, the latest model) is read
 * only for the page returned and only for a file of a few MB.
 */

import { open, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { claudeProjectDir } from "./claude-store.ts";

import type { HistorySession } from "../shared/protocol.ts";

const SESSION_FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i;
/** How much of a transcript's start and end is read for its folder, title and model. */
const CHUNK_BYTES = 128 * 1024;
/** Above this a transcript is not read whole: its prompt count is unknown (null). */
const COUNT_MAX_BYTES = 4 * 1024 * 1024;
const PREVIEW_CHARS = 140;
/** How long a listing of the store is reused: Show more and a changed filter do not stat every transcript again. */
const LISTING_TTL_MS = 3000;
/** Claude hashes a project directory name of this length or more (claude-store.ts). */
const MAX_NAME = 200;
const READ_BATCH = 16;
/** Content that starts a user line without being something the user wrote. */
const NOT_A_PROMPT = ["<local-command-caveat>", "<local-command-stdout>", "<system-reminder>", "<command-name>", "<command-message>", "[Request interrupted"];

export interface HistoryQuery {
  configDir: string;
  /** absolute folders (a project's, and its worktrees'): a session matches when it ran in or below any */
  folders: readonly string[];
  /** epoch ms: sessions with no activity since then are left out */
  since: number;
  /** `claude -p` sessions (entrypoint sdk-cli) are left out unless asked for */
  automated: boolean;
  offset: number;
  limit: number;
}

interface Meta { cwd: string | null; branch: string | null; automated: boolean; title: string | null; prompt: string | null; model: string | null }

/** Whether `cwd` is `folder` or a path below it (either separator: a transcript may come from Windows). */
export function insideFolder(cwd: string, folder: string): boolean {
  const root = folder.length > 1 ? folder.replace(/[\\/]+$/, "") : folder;
  if (cwd === root) return true;
  if (root === "/" || root === "") return cwd.startsWith("/");
  return cwd.startsWith(`${root}/`) || cwd.startsWith(`${root}\\`);
}

/** The text a user line carries, or null for a tool result and any other line that is not a prompt. */
function promptText(message: unknown): string | null {
  const content = (message as { content?: unknown } | null)?.content;
  let text: string | null = null;
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) {
    const blocks = content as { type?: unknown; text?: unknown }[];
    if (blocks.some((block) => block?.type === "tool_result")) return null;
    text = blocks.filter((block) => block?.type === "text" && typeof block.text === "string").map((block) => block.text).join("\n") || null;
  }
  const trimmed = text?.trim();
  if (!trimmed || NOT_A_PROMPT.some((prefix) => trimmed.startsWith(prefix))) return null;
  return trimmed.replace(/\s+/g, " ").slice(0, PREVIEW_CHARS);
}

/** The model an assistant turn of the main conversation names; a side chain's and a synthetic one are not the session's. */
function modelOf(entry: Record<string, unknown>): string | null {
  if (entry["isSidechain"] === true) return null;
  const model = (entry["message"] as { model?: unknown } | null)?.model;
  return typeof model === "string" && !model.startsWith("<") ? model : null;
}

/** What a run of transcript lines says about the session; `meta` already holds what an earlier run found. */
function readLines(text: string, meta: Meta, tail: boolean): void {
  for (const line of text.split("\n")) {
    if (!line.startsWith("{")) continue;
    let entry: Record<string, unknown>;
    try { entry = JSON.parse(line) as Record<string, unknown>; } catch { continue; }
    if (meta.cwd === null && typeof entry["cwd"] === "string") {
      meta.cwd = entry["cwd"];
      meta.automated = typeof entry["entrypoint"] === "string" && entry["entrypoint"].startsWith("sdk-");
    }
    if (meta.branch === null && typeof entry["gitBranch"] === "string" && entry["gitBranch"] !== "") meta.branch = entry["gitBranch"];
    if (entry["type"] === "custom-title" && typeof entry["customTitle"] === "string" && entry["customTitle"].trim() !== "") meta.title = entry["customTitle"].trim().slice(0, 200);
    else if (!tail && meta.prompt === null && entry["type"] === "user" && entry["isSidechain"] !== true && entry["isMeta"] !== true) meta.prompt = promptText(entry["message"]);
    else if (entry["type"] === "assistant") meta.model = modelOf(entry) ?? meta.model;
  }
}

/** The bytes of `path` from `start`, as text cut to whole lines (a chunk's first and last lines may be partial). */
async function chunk(path: string, start: number, length: number, size: number): Promise<string> {
  const file = await open(path, "r");
  try {
    const bytes = Buffer.alloc(length);
    const { bytesRead } = await file.read(bytes, 0, length, start);
    let text = bytes.subarray(0, bytesRead).toString("utf8");
    if (start > 0) text = text.slice(text.indexOf("\n") + 1);
    if (start + bytesRead < size) text = text.slice(0, text.lastIndexOf("\n"));
    return text;
  } finally { await file.close(); }
}

/** Parsed heads and tails, by file, size and mtime: a poll of the History view reparses nothing that did not change. */
const metaCache = new Map<string, Meta>();
const META_CACHE_MAX = 1000;

interface Detail { prompts: number; title: string | null; model: string | null }
const detailCache = new Map<string, Detail>();
const listings = new Map<string, { at: number; files: Candidate[] }>();

export function forgetClaudeHistory(): void { metaCache.clear(); detailCache.clear(); listings.clear(); }

async function metaOf(path: string, size: number, mtime: number): Promise<Meta> {
  const key = `${path}\0${size}\0${mtime}`;
  const known = metaCache.get(key);
  if (known) return known;
  const meta: Meta = { cwd: null, branch: null, automated: false, title: null, prompt: null, model: null };
  // ponytail: a prompt or /rename that sits in the middle of a file bigger than 2 chunks is not found: it shows the first prompt, or none
  readLines(await chunk(path, 0, Math.min(size, CHUNK_BYTES), size), meta, false);
  if (size > CHUNK_BYTES) readLines(await chunk(path, Math.max(CHUNK_BYTES, size - CHUNK_BYTES), Math.min(CHUNK_BYTES, size - CHUNK_BYTES), size), meta, true);
  if (metaCache.size >= META_CACHE_MAX) metaCache.delete(metaCache.keys().next().value!);
  metaCache.set(key, meta);
  return meta;
}

/**
 * What only the whole transcript tells: how many real prompts the user typed (not tool results,
 * notices or side chains), the last /rename wherever it sits, and the model of the last main-chain
 * turn. Null for a transcript too big to read whole. Only lines that can matter are parsed.
 */
async function detailOf(path: string, size: number, mtime: number): Promise<Detail | null> {
  if (size > COUNT_MAX_BYTES) return null;
  const key = `${path}\0${size}\0${mtime}`;
  const known = detailCache.get(key);
  if (known) return known;
  const lines = (await readFile(path, "utf8")).split("\n");
  const detail: Detail = { prompts: 0, title: null, model: null };
  const parse = (line: string): Record<string, unknown> | null => { try { return JSON.parse(line) as Record<string, unknown>; } catch { return null; } };
  for (const line of lines) {
    if (!line.startsWith("{")) continue;
    const isUser = line.includes('"type":"user"');
    if (!isUser && !line.includes('"type":"custom-title"')) continue;
    const entry = parse(line);
    if (!entry) continue;
    if (entry["type"] === "custom-title" && typeof entry["customTitle"] === "string" && entry["customTitle"].trim() !== "") detail.title = entry["customTitle"].trim().slice(0, 200);
    else if (entry["type"] === "user" && entry["isSidechain"] !== true && entry["isMeta"] !== true && promptText(entry["message"]) !== null) detail.prompts += 1;
  }
  for (let at = lines.length - 1; at >= 0 && detail.model === null; at--) {
    const line = lines[at]!;
    if (line.startsWith("{") && line.includes('"type":"assistant"')) detail.model = modelOf(parse(line) ?? {});
  }
  if (detailCache.size >= META_CACHE_MAX) detailCache.delete(detailCache.keys().next().value!);
  detailCache.set(key, detail);
  return detail;
}

interface Candidate { path: string; id: string; size: number; mtime: number }

/** Every transcript in the store touched since `since`, newest first. Symlinks are not followed. */
async function candidates(configDir: string, folders: readonly string[], since: number): Promise<Candidate[]> {
  // a project directory is named for the folder Claude started in, so a folder's own and the ones
  // below it share its name as a prefix; a name Claude had to hash cannot be told that way
  const names = folders.map(claudeProjectDir);
  const prefixes = names.every((name) => name.length < MAX_NAME) ? names : null;
  const key = `${configDir}\0${prefixes?.join("\0") ?? ""}`;
  const known = listings.get(key);
  if (known && Date.now() - known.at < LISTING_TTL_MS) return known.files.filter((file) => file.mtime >= since);
  const files = await listStore(configDir, prefixes);
  listings.set(key, { at: Date.now(), files });
  return files.filter((file) => file.mtime >= since);
}

/** `prefixes`: only the project directories that start with one, unless none does (Claude's naming may have changed): then all. */
async function listStore(configDir: string, prefixes: readonly string[] | null): Promise<Candidate[]> {
  const projects = join(configDir, "projects");
  let dirs;
  try { dirs = await readdir(projects, { withFileTypes: true }); } catch { return []; }
  dirs = dirs.filter((dir) => dir.isDirectory());
  const near = prefixes === null ? dirs : dirs.filter((dir) => prefixes.some((prefix) => dir.name.startsWith(prefix)));
  if (near.length > 0) dirs = near;
  const found: Candidate[] = [];
  await Promise.all(dirs.map(async (dir) => {
    let files;
    try { files = await readdir(join(projects, dir.name), { withFileTypes: true }); } catch { return; }
    await Promise.all(files.filter((file) => file.isFile() && SESSION_FILE.test(file.name)).map(async (file) => {
      const path = join(projects, dir.name, file.name);
      try {
        const info = await stat(path);
        found.push({ path, id: SESSION_FILE.exec(file.name)![1]!.toLowerCase(), size: info.size, mtime: Math.round(info.mtimeMs) });
      } catch { /* gone since the listing */ }
    }));
  }));
  return found.sort((a, b) => b.mtime - a.mtime);
}

export async function claudeHistory(query: HistoryQuery): Promise<{ sessions: HistorySession[]; has_more: boolean }> {
  const wanted = query.offset + query.limit + 1;
  const matched: (Candidate & { meta: Meta })[] = [];
  const all = await candidates(query.configDir, query.folders, query.since);
  // newest first, so the page is full after the first files that match: older ones are never opened
  for (let at = 0; at < all.length && matched.length < wanted; at += READ_BATCH) {
    const batch = all.slice(at, at + READ_BATCH);
    const metas = await Promise.all(batch.map((file) => metaOf(file.path, file.size, file.mtime).catch(() => null)));
    batch.forEach((file, index) => {
      const meta = metas[index];
      if (meta?.cwd && query.folders.some((folder) => insideFolder(meta.cwd!, folder)) && (query.automated || !meta.automated)) matched.push({ ...file, meta });
    });
  }
  const page = matched.slice(query.offset, query.offset + query.limit);
  const details = await Promise.all(page.map((file) => detailOf(file.path, file.size, file.mtime).catch(() => null)));
  return {
    has_more: matched.length > query.offset + query.limit,
    sessions: page.map((file, index) => ({
      session_id: file.id,
      title: details[index]?.title ?? file.meta.title ?? file.meta.prompt ?? "",
      first_prompt: file.meta.prompt ?? "",
      last_activity: file.mtime,
      prompt_count: details[index]?.prompts ?? null,
      git_branch: file.meta.branch,
      model: details[index]?.model ?? file.meta.model,
      cwd: file.meta.cwd!,
      automated: file.meta.automated,
    })),
  };
}
