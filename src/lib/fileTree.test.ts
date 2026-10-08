import { describe, expect, it } from "bun:test";
import { expandedKey, fileIcon, filterEntries, filterRows, highlight, pendingFolders, readExpanded, treeKey, visibleRows, writeExpanded, type DirState, type TreeRow } from "./fileTree.ts";

const root = {
  directories: ["docs", "src"],
  files: [{ name: "README.md", size: 10 }],
  truncated: false,
};
const ok = (directories: string[], files: string[] = [], truncated = false): DirState => ({ status: "ok", directories, files: files.map((name) => ({ name, size: 1 })), truncated });

describe("visibleRows", () => {
  it("lists the root's folders then files, closed", () => {
    const rows = visibleRows(root, "/p", {}, new Set());
    expect(rows.map((row) => `${row.type}:${row.path}:${row.level}`)).toEqual(["dir:/p/docs:0", "dir:/p/src:0", "file:/p/README.md:0"]);
  });

  it("puts an open folder's children under it, one level deeper, and a loading row while unread", () => {
    const open = new Set(["/p/src", "/p/src/lib"]);
    const rows = visibleRows(root, "/p", { "/p/src": ok(["lib"], ["a.ts"]) }, open);
    expect(rows.map((row) => `${row.type}${row.note ? `(${row.note})` : ""}:${row.name}:${row.level}`)).toEqual([
      "dir:docs:0", "dir:src:0", "dir:lib:1", "note(loading)::2", "file:a.ts:1", "file:README.md:0",
    ]);
    expect(pendingFolders(rows)).toEqual(["/p/src/lib"]);
  });

  it("says a folder is empty, failed, or cut at the server's cap", () => {
    const open = new Set(["/p/docs", "/p/src"]);
    const rows = visibleRows({ ...root, truncated: true }, "/p", { "/p/docs": ok([]), "/p/src": { status: "error" } }, open);
    expect(rows.filter((row) => row.type === "note").map((row) => `${row.note}@${row.level}`)).toEqual(["empty@1", "error@1", "truncated@0"]);
  });
});

describe("treeKey", () => {
  const rows: TreeRow[] = [
    { type: "dir", path: "/a", name: "a", sep: "", level: 0, expanded: true },
    { type: "dir", path: "/a/b", name: "b", sep: "", level: 1, expanded: false },
    { type: "note", path: "/a", name: "", sep: "", level: 1, expanded: false, note: "truncated" },
    { type: "file", path: "/a/f", name: "f", sep: "", level: 1, expanded: false },
    { type: "file", path: "/z", name: "z", sep: "", level: 0, expanded: false },
  ];
  it("moves over items, skipping notes, and clamps at both ends", () => {
    expect(treeKey(rows, "/a/b", "ArrowDown")).toEqual({ do: "focus", path: "/a/f" });
    expect(treeKey(rows, "/a", "ArrowUp")).toEqual({ do: "focus", path: "/a" });
    expect(treeKey(rows, "/z", "ArrowDown")).toEqual({ do: "focus", path: "/z" });
    expect(treeKey(rows, "/a/f", "Home")).toEqual({ do: "focus", path: "/a" });
    expect(treeKey(rows, "/a", "End")).toEqual({ do: "focus", path: "/z" });
    expect(treeKey(rows, null, "ArrowDown")).toEqual({ do: "focus", path: "/a" });
  });
  it("Right opens a closed folder or enters an open one; Left closes or leaves", () => {
    expect(treeKey(rows, "/a/b", "ArrowRight")).toEqual({ do: "expand", path: "/a/b" });
    expect(treeKey(rows, "/a", "ArrowRight")).toEqual({ do: "focus", path: "/a/b" });
    expect(treeKey(rows, "/a/f", "ArrowRight")).toBeNull();
    expect(treeKey(rows, "/a", "ArrowLeft")).toEqual({ do: "collapse", path: "/a" });
    expect(treeKey(rows, "/a/f", "ArrowLeft")).toEqual({ do: "focus", path: "/a" });
    expect(treeKey(rows, "/a/b", "ArrowLeft")).toEqual({ do: "focus", path: "/a" });
    expect(treeKey(rows, "/z", "ArrowLeft")).toBeNull();
  });
  it("never collapses or expands while filtering", () => {
    expect(treeKey(rows, "/a", "ArrowLeft", true)).toBeNull();
    expect(treeKey(rows, "/a/b", "ArrowRight", true)).toBeNull();
  });
});

describe("filter", () => {
  it("finds names in the loaded folders, case-insensitively, and files the search returned", () => {
    const entries = filterEntries(root, "/p", { "/p/docs": ok(["Reading"], ["readme-pt.md", "x.md"]) }, ["src/lib/readable.txt", ".hid/readme"], "READ", false);
    expect(entries.map((entry) => `${entry.kind}:${entry.rel}`).sort()).toEqual(["dir:docs/Reading", "file:README.md", "file:docs/readme-pt.md", "file:src/lib/readable.txt"]);
    expect(filterEntries(root, "/p", {}, [".hid/readme"], "read", true).map((entry) => entry.rel)).toContain(".hid/readme");
  });

  it("folds a chain of single-child folders into one row and keeps the file under it", () => {
    const rows = filterRows(filterEntries(root, "/p", {}, ["src/lib/__tests__/fixtures/readable.txt", "src/lib/__tests__/fixtures/other-read.txt", "docs/readme.md"], "read", false), "/p");
    expect(rows.map((row) => `${row.level}|${row.sep}|${row.name}|${row.type}`)).toEqual([
      "0||docs|dir", "1||readme.md|file",
      "0|src/lib/__tests__/|fixtures|dir", "1||other-read.txt|file", "1||readable.txt|file",
      "0||README.md|file",
    ]);
    expect(rows[2]!.path).toBe("/p/src/lib/__tests__/fixtures");
    expect(rows[2]!.expanded).toBe(true);
  });

  it("folds into a folder that matched, but not out of it, and shows it closed when nothing under it did", () => {
    const rows = filterRows([{ rel: "a/reading", kind: "dir" }, { rel: "a/reading/x/read.md", kind: "file" }, { rel: "b/reading", kind: "dir" }], "/p");
    expect(rows.map((row) => `${row.level}|${row.sep}${row.name}|${row.expanded}`)).toEqual(["0|a/reading|true", "1|x|true", "2|read.md|false", "0|b/reading|false"]);
  });

  it("splits a name around the match", () => {
    expect(highlight("README.md", "read")).toEqual({ before: "", hit: "READ", after: "ME.md" });
    expect(highlight("a.ts", "zz")).toBeNull();
    expect(highlight("a.ts", "  ")).toBeNull();
  });
});

describe("memory", () => {
  it("reads what was written, and survives a broken store", () => {
    const store = new Map<string, string>();
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } });
    try {
      const key = expandedKey("local", "/p");
      writeExpanded(key, new Set(["/p/a", "/p/b"]));
      expect([...readExpanded(key)]).toEqual(["/p/a", "/p/b"]);
      writeExpanded(key, new Set());
      expect(store.has(key)).toBe(false);
      store.set(key, "{oops");
      expect(readExpanded(key).size).toBe(0);
      store.set(key, JSON.stringify(["/ok", 3, null]));
      expect([...readExpanded(key)]).toEqual(["/ok"]);
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original); else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });
  it("picks an icon by extension", () => {
    expect([fileIcon("a.MD"), fileIcon("a.tsx"), fileIcon("a.json"), fileIcon("a.png"), fileIcon("a.pdf"), fileIcon("Makefile"), fileIcon(".env")]).toEqual(["text", "code", "json", "image", "pdf", "file", "file"]);
  });
});
