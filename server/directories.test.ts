import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { createDirectory, listDirectories, MAX_DIRECTORY_ENTRIES } from "./directories.ts";

describe("listDirectories", () => {
  const roots: string[] = [];
  afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
  const temp = () => { const root = mkdtempSync(join(tmpdir(), "herdr-dirs-")); roots.push(root); return root; };

  it("lists folders only, sorted naturally, with links to folders and without hidden ones", () => {
    const root = temp();
    for (const name of ["web", "api10", "api2", ".git", "Docs"]) mkdirSync(join(root, name));
    writeFileSync(join(root, "README.md"), "");
    symlinkSync(join(root, "web"), join(root, "web-link"));
    symlinkSync(join(root, "missing"), join(root, "dangling"));
    const listing = listDirectories(root)!;
    expect(listing.directories).toEqual(["api2", "api10", "Docs", "web", "web-link"]);
    expect(listing.path).toBe(root);
    expect(listing.parent).toBe(tmpdir());
    expect(listing.truncated).toBe(false);
    expect(listDirectories(root, true)!.directories).toContain(".git");
  });

  it("reads ~ and an empty path as home, and has no parent at the root", () => {
    expect(listDirectories("")!.path).toBe(homedir());
    expect(listDirectories("~")!.path).toBe(homedir());
    expect(listDirectories("/")!.parent).toBeNull();
  });

  it("answers null for a file or a missing path, and stops at the cap", () => {
    const root = temp();
    writeFileSync(join(root, "file"), "");
    expect(listDirectories(join(root, "file"))).toBeNull();
    expect(listDirectories(join(root, "nope"))).toBeNull();
    for (let n = 0; n <= MAX_DIRECTORY_ENTRIES; n++) mkdirSync(join(root, `d${n}`));
    const listing = listDirectories(root)!;
    expect(listing.directories).toHaveLength(MAX_DIRECTORY_ENTRIES);
    expect(listing.truncated).toBe(true);
  });
});

describe("createDirectory", () => {
  const roots: string[] = [];
  afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
  const temp = () => { const root = mkdtempSync(join(tmpdir(), "herdr-mkdir-")); roots.push(root); return root; };

  it("makes one folder inside the parent and answers its path", () => {
    const root = temp();
    expect(createDirectory(root, "nova")).toEqual({ path: join(root, "nova") });
    expect(listDirectories(root)!.directories).toContain("nova");
  });

  it("trims the name, and refuses separators, dot names and an empty one", () => {
    const root = temp();
    expect(createDirectory(root, "  spaced  ")).toEqual({ path: join(root, "spaced") });
    for (const name of ["", "   ", ".", "..", "a/b", "a\\b", "x\0y"]) {
      expect(createDirectory(root, name)).toEqual({ error: "invalid_name" });
    }
  });

  it("refuses a missing parent and a name already there", () => {
    const root = temp();
    mkdirSync(join(root, "here"));
    expect(createDirectory(join(root, "nope"), "x")).toEqual({ error: "not_found" });
    expect(createDirectory(root, "here")).toEqual({ error: "exists" });
  });
});
