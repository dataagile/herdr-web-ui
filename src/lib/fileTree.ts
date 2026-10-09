/** The Files dialog's tree: rows from the folders loaded so far, the filter's tree, the keyboard model and what is remembered. */

export interface DirEntries {
  directories: string[];
  files: { name: string; size: number }[];
  truncated: boolean;
}

/** A folder's listing as the tree holds it: asked for, failed, or read. */
export type DirState = { status: "loading" } | { status: "error" } | ({ status: "ok" } & DirEntries);

export interface TreeRow {
  /** a note takes the place of a folder's children: loading, failed, empty or cut by the server's cap */
  type: "dir" | "file" | "note";
  /** absolute; for a note, the folder it belongs to */
  path: string;
  name: string;
  /** the folders a single-child chain folded into this row (`src/lib/`), dimmed before `name` */
  sep: string;
  /** 0 for the root's children */
  level: number;
  expanded: boolean;
  size?: number;
  note?: "loading" | "error" | "empty" | "truncated";
}

export function childPath(parent: string, name: string): string {
  return parent.endsWith("/") ? `${parent}${name}` : `${parent}/${name}`;
}

/** The rows to draw: the root's folders then files, an open folder followed by its own. */
export function visibleRows(root: DirEntries, rootPath: string, loaded: Record<string, DirState>, expanded: ReadonlySet<string>): TreeRow[] {
  const rows: TreeRow[] = [];
  const note = (path: string, level: number, kind: NonNullable<TreeRow["note"]>): void => {
    rows.push({ type: "note", path, name: "", sep: "", level, expanded: false, note: kind });
  };
  const walk = (dir: string, entries: DirEntries, level: number): void => {
    for (const name of entries.directories) {
      const path = childPath(dir, name);
      const open = expanded.has(path);
      rows.push({ type: "dir", path, name, sep: "", level, expanded: open });
      if (!open) continue;
      const state = loaded[path];
      if (state === undefined || state.status === "loading") note(path, level + 1, "loading");
      else if (state.status === "error") note(path, level + 1, "error");
      else if (state.directories.length === 0 && state.files.length === 0) note(path, level + 1, "empty");
      else walk(path, state, level + 1);
    }
    for (const file of entries.files) rows.push({ type: "file", path: childPath(dir, file.name), name: file.name, sep: "", level, expanded: false, size: file.size });
    if (entries.truncated) note(dir, level, "truncated");
  };
  walk(rootPath, root, 0);
  return rows;
}

/** Folders the tree must still read: open ones with no answer yet. */
export function pendingFolders(rows: readonly TreeRow[]): string[] {
  return rows.filter((row) => row.type === "note" && row.note === "loading").map((row) => row.path);
}

// ---- filter ----

export interface FilterEntry {
  /** relative to the root */
  rel: string;
  kind: "dir" | "file";
  size?: number;
}

const matches = (name: string, query: string): boolean => name.toLowerCase().includes(query.toLowerCase());

/** `name` split around the first (case-insensitive) occurrence of `query`; null when it holds none. */
export function highlight(name: string, query: string): { before: string; hit: string; after: string } | null {
  const q = query.trim();
  const at = q === "" ? -1 : name.toLowerCase().indexOf(q.toLowerCase());
  return at < 0 ? null : { before: name.slice(0, at), hit: name.slice(at, at + q.length), after: name.slice(at + q.length) };
}

/**
 * What the filter shows: the loaded entries whose name holds the query, and the paths the server's
 * search found under the root (files; their folders come from the path). Hidden names stay out
 * unless asked for.
 */
export function filterEntries(root: DirEntries, rootPath: string, loaded: Record<string, DirState>, found: readonly string[], query: string, hidden: boolean): FilterEntry[] {
  const q = query.trim();
  const out = new Map<string, FilterEntry>();
  const base = rootPath.replace(/\/$/, "");
  const add = (entry: FilterEntry): void => {
    if (!hidden && entry.rel.split("/").some((part) => part.startsWith("."))) return;
    const key = `${entry.kind}:${entry.rel}`;
    if (!out.has(key)) out.set(key, entry);
  };
  const scan = (rel: string, entries: DirEntries): void => {
    const at = (name: string): string => (rel === "" ? name : `${rel}/${name}`);
    for (const name of entries.directories) if (matches(name, q)) add({ rel: at(name), kind: "dir" });
    for (const file of entries.files) if (matches(file.name, q)) add({ rel: at(file.name), kind: "file", size: file.size });
  };
  scan("", root);
  for (const [path, state] of Object.entries(loaded)) {
    if (state.status === "ok" && path.startsWith(`${base}/`)) scan(path.slice(base.length + 1), state);
  }
  // the server's search is fuzzy over the whole path: only a file whose own name holds the query stays
  for (const path of found) if (matches(path.slice(path.lastIndexOf("/") + 1), q)) add({ rel: path, kind: "file" });
  return [...out.values()];
}

interface FilterNode {
  name: string;
  rel: string;
  kind: "dir" | "file";
  size?: number;
  /** the folder itself matched (it is a row of its own even when a single child would fold it) */
  listed: boolean;
  children: Map<string, FilterNode>;
}

/**
 * The filter's rows: matches with their ancestor folders, all open. A folder that only leads to
 * one other folder folds into it (`a/b/c`), so a deep match is one row, not a staircase.
 */
export function filterRows(entries: readonly FilterEntry[], rootPath: string): TreeRow[] {
  const top: FilterNode = { name: "", rel: "", kind: "dir", listed: false, children: new Map() };
  for (const entry of entries) {
    let node = top;
    const parts = entry.rel.split("/");
    parts.forEach((part, index) => {
      const last = index === parts.length - 1;
      const kind = last ? entry.kind : "dir";
      let child = node.children.get(`${kind}:${part}`);
      if (child === undefined) {
        child = { name: part, rel: parts.slice(0, index + 1).join("/"), kind, listed: false, children: new Map() };
        node.children.set(`${kind}:${part}`, child);
      }
      if (last) { child.listed = true; if (entry.size !== undefined) child.size = entry.size; }
      node = child;
    });
  }
  const rows: TreeRow[] = [];
  const base = rootPath.replace(/\/$/, "");
  const walk = (node: FilterNode, level: number): void => {
    const ordered = [...node.children.values()].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "dir" ? -1 : 1) || a.name.localeCompare(b.name));
    for (const child of ordered) {
      if (child.kind === "file") {
        rows.push({ type: "file", path: `${base}/${child.rel}`, name: child.name, sep: "", level, expanded: false, size: child.size });
        continue;
      }
      let current = child;
      let sep = "";
      while (!current.listed && current.children.size === 1) {
        const only = [...current.children.values()][0]!;
        if (only.kind !== "dir") break;
        sep += `${current.name}/`;
        current = only;
      }
      rows.push({ type: "dir", path: `${base}/${current.rel}`, name: current.name, sep, level, expanded: current.children.size > 0 });
      walk(current, level + 1);
    }
  };
  walk(top, 0);
  return rows;
}

/**
 * The folder the search fits: the pane's own, i.e. the first listing that answered the request for
 * it. A listing that fell back to home (the folder was empty or unreadable) is not it.
 */
export function paneRoot(current: string | null, requested: string, start: string, listed: string): string | null {
  return current ?? (start !== "" && requested === start ? listed : null);
}

/**
 * The filter's rows with the folders the user closed folded: their descendants leave and the row
 * reads as closed, so a click can open it again.
 */
export function foldRows(rows: readonly TreeRow[], closed: ReadonlySet<string>): TreeRow[] {
  if (closed.size === 0) return [...rows];
  const out: TreeRow[] = [];
  let hiding: string | null = null;
  for (const row of rows) {
    if (hiding !== null && row.path.startsWith(`${hiding}/`)) continue;
    hiding = null;
    if (row.type === "dir" && closed.has(row.path)) { hiding = row.path; out.push({ ...row, expanded: false }); continue; }
    out.push(row);
  }
  return out;
}

export interface TreeNode {
  row: TreeRow;
  children: TreeNode[];
  /** 1-based place among the sibling items (notes do not count), and how many there are */
  pos: number;
  size: number;
}

/** The flat rows as nested nodes (a row's children are the deeper rows right after it), for `role="group"`. */
export function nestRows(rows: readonly TreeRow[]): TreeNode[] {
  const top: TreeNode[] = [];
  const stack: TreeNode[] = [];
  for (const row of rows) {
    const node: TreeNode = { row, children: [], pos: 0, size: 0 };
    while (stack.length > 0 && stack[stack.length - 1]!.row.level >= row.level) stack.pop();
    (stack.length > 0 ? stack[stack.length - 1]!.children : top).push(node);
    stack.push(node);
  }
  const number = (nodes: TreeNode[]): void => {
    const items = nodes.filter((node) => node.row.type !== "note");
    items.forEach((node, index) => { node.pos = index + 1; node.size = items.length; });
    for (const node of nodes) number(node.children);
  };
  number(top);
  return top;
}

// ---- keyboard ----

export type TreeAction =
  | { do: "focus" | "expand" | "collapse"; path: string }
  | null;

/**
 * What a key does on the tree (WAI-ARIA tree pattern): Up/Down move, Home/End jump, Right opens a
 * closed folder or steps into an open one, Left closes an open folder or steps out to its parent,
 * While filtering every folder is open and stays so. Enter and Space are the row button's own click.
 */
export function treeKey(rows: readonly TreeRow[], active: string | null, key: string, filtering = false): TreeAction {
  const items = rows.filter((row) => row.type !== "note");
  if (items.length === 0) return null;
  const at = items.findIndex((row) => row.path === active);
  const focus = (index: number): TreeAction => ({ do: "focus", path: items[Math.min(items.length - 1, Math.max(0, index))]!.path });
  switch (key) {
    case "ArrowDown": return focus(at < 0 ? 0 : at + 1);
    case "ArrowUp": return focus(at < 0 ? items.length - 1 : at - 1);
    case "Home": return focus(0);
    case "End": return focus(items.length - 1);
  }
  const row = items[at];
  if (row === undefined) return null;
  switch (key) {
    case "ArrowRight":
      if (row.type !== "dir") return null;
      if (!row.expanded && !filtering) return { do: "expand", path: row.path };
      return items[at + 1] !== undefined && items[at + 1]!.level > row.level ? focus(at + 1) : null;
    case "ArrowLeft": {
      if (row.type === "dir" && row.expanded && !filtering) return { do: "collapse", path: row.path };
      for (let index = at - 1; index >= 0; index--) if (items[index]!.level < row.level) return focus(index);
      return null;
    }
  }
  return null;
}

// ---- icons and memory ----

export type FileIcon = "text" | "code" | "json" | "image" | "pdf" | "file";

const ICON_BY_EXTENSION: Record<string, FileIcon> = {
  md: "text", markdown: "text", txt: "text", log: "text", rst: "text",
  ts: "code", tsx: "code", js: "code", jsx: "code", mjs: "code", cjs: "code", css: "code", scss: "code", html: "code", htm: "code",
  py: "code", go: "code", rs: "code", java: "code", c: "code", h: "code", cpp: "code", sh: "code", sql: "code", yml: "code", yaml: "code", toml: "code", xml: "code", prw: "code", tlpp: "code",
  json: "json",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image", avif: "image", bmp: "image",
  pdf: "pdf",
};

export function fileIcon(name: string): FileIcon {
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "file" : ICON_BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? "file";
}

/** Open folders are remembered per PC and per pane folder. */
export function expandedKey(machineId: string, start: string): string {
  return `herdr-web-ui:files-tree:${machineId}:${start}`;
}

export function readExpanded(key: string): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

/** Saves the open folders: the 200 most recent (the set keeps the order they were opened in), only those inside `root` when it is known. */
export function writeExpanded(key: string, expanded: ReadonlySet<string>, root: string | null = null): void {
  const inside = root === null ? [...expanded] : [...expanded].filter((path) => path.startsWith(`${root.replace(/\/$/, "")}/`));
  try {
    if (inside.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(inside.slice(-200)));
  } catch {}
}
