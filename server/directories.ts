import { mkdirSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import type { DirectoryListing } from "../shared/protocol.ts";

/** A folder with more subfolders than this lists the first ones and says it stopped. */
export const MAX_DIRECTORY_ENTRIES = 500;

/** The folder a browser path means: absolute, `~`/`~/…`, else resolved against `base` (a pane's folder). */
function resolveDirectory(path: string, base?: string): string {
  const home = homedir();
  const trimmed = path.trim();
  if (trimmed === "" || trimmed === "~") return home;
  if (trimmed.startsWith("~/")) return resolve(home, trimmed.slice(2));
  return base !== undefined ? resolve(base, trimmed) : resolve(trimmed);
}

/**
 * The folders inside one directory, for the new-session dialog's folder browser. One
 * directory at a time, names only, nothing kept between calls: the cost is one readdir.
 * `path` takes an absolute path, `~` or `~/…` (the dialog's own syntax); empty means home.
 * Hidden folders (a leading dot) are left out unless asked for. Null when `path` is not
 * a directory this user can read.
 */
/** `base`: the folder a relative path is read from (a pane's, for a link in its chat); else the server's own. */
export function listDirectories(path: string, hidden = false, withFiles = false, base?: string): DirectoryListing | null {
  const home = homedir();
  const target = resolveDirectory(path, base);
  let entries;
  try {
    if (!statSync(target).isDirectory()) return null;
    entries = readdirSync(target, { withFileTypes: true });
  } catch {
    return null;
  }
  const directories: string[] = [];
  const files: { name: string; size: number }[] = [];
  for (const entry of entries) {
    if (!hidden && entry.name.startsWith(".")) continue;
    let isDirectory = entry.isDirectory();
    let isFile = entry.isFile();
    // a link is what it points at (a dangling or looping one is neither)
    if (entry.isSymbolicLink()) {
      try { const target_ = statSync(join(target, entry.name)); isDirectory = target_.isDirectory(); isFile = target_.isFile(); } catch { isDirectory = false; isFile = false; }
    }
    if (isDirectory) directories.push(entry.name);
    else if (withFiles && isFile && files.length <= MAX_DIRECTORY_ENTRIES) {
      let size = 0;
      try { size = statSync(join(target, entry.name)).size; } catch { continue; }
      files.push({ name: entry.name, size });
    }
  }
  const byName = (left: string, right: string) => left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
  directories.sort(byName);
  files.sort((left, right) => byName(left.name, right.name));
  const parent = dirname(target);
  return {
    path: target,
    parent: parent === target ? null : parent,
    home,
    directories: directories.slice(0, MAX_DIRECTORY_ENTRIES),
    truncated: directories.length > MAX_DIRECTORY_ENTRIES || files.length > MAX_DIRECTORY_ENTRIES,
    ...(withFiles ? { files: files.slice(0, MAX_DIRECTORY_ENTRIES) } : {}),
  };
}

/** Why a folder the browser asked to create was not made (the route maps each to its status). */
export type CreateDirectoryResult = { path: string } | { error: "invalid_name" | "not_found" | "exists" | "failed" };

/**
 * Creates one folder inside a directory the browser shows. `name` is a single segment:
 * anything with a separator, or `.`/`..`, is refused. The parent must be a directory this
 * user can read, and the folder keeps the server's default mode. Resolves to the new path.
 */
export function createDirectory(path: string, name: string, base?: string): CreateDirectoryResult {
  const folder = name.trim();
  if (folder === "" || folder === "." || folder === ".." || /[/\\\0]/.test(folder)) return { error: "invalid_name" };
  const parent = resolveDirectory(path, base);
  try {
    if (!statSync(parent).isDirectory()) return { error: "not_found" };
  } catch {
    return { error: "not_found" };
  }
  const target = join(parent, folder);
  try {
    mkdirSync(target);
  } catch (error) {
    return { error: (error as NodeJS.ErrnoException).code === "EEXIST" ? "exists" : "failed" };
  }
  return { path: target };
}
