import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { FileWriteError, MAX_TEXT_WRITE_BYTES, fileInfo, fileResponse, resolveFilePath, writeTextFile } from "./file-view.ts";

describe("file view", () => {
  const roots: string[] = [];
  afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
  const temp = () => { const root = mkdtempSync(join(tmpdir(), "herdr-file-view-")); roots.push(root); return root; };

  it("resolves absolute, ~ and pane-relative paths", () => {
    expect(resolveFilePath("/a/b.txt", "/work")).toBe("/a/b.txt");
    expect(resolveFilePath("~/x.png", null)).toBe(join(homedir(), "x.png"));
    expect(resolveFilePath("docs/demo.mp4", "/work/app")).toBe("/work/app/docs/demo.mp4");
    expect(resolveFilePath("docs/demo.mp4", null)).toBeNull();
    expect(resolveFilePath("  ", "/work")).toBeNull();
  });

  it("tells media, text and binary apart, and is null for a folder or nothing", () => {
    const root = temp();
    writeFileSync(join(root, "a.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(join(root, "run.log"), "line\n");
    writeFileSync(join(root, "blob"), Buffer.from([1, 0, 2]));
    writeFileSync(join(root, "notes"), "plain words");
    expect(fileInfo(join(root, "a.png"))!.kind).toBe("image");
    expect(fileInfo(join(root, "run.log"))!.kind).toBe("text");
    expect(fileInfo(join(root, "blob"))!.kind).toBe("binary");
    expect(fileInfo(join(root, "notes"))!.kind).toBe("text");
    expect(fileInfo(root)).toBeNull();
    expect(fileInfo(join(root, "missing"))).toBeNull();
  });

  it("serves HTML as sandboxed plain text, and a download as an attachment", async () => {
    const root = temp();
    writeFileSync(join(root, "page.html"), "<script>alert(1)</script>");
    const response = fileResponse(fileInfo(join(root, "page.html"))!, true);
    expect(response.headers.get("content-type")).toStartWith("text/plain");
    expect(response.headers.get("content-security-policy")).toStartWith("sandbox");
    expect(response.headers.get("content-disposition")).toBe("attachment; filename*=UTF-8''page.html");
    expect(await response.text()).toBe("<script>alert(1)</script>");
  });

  it("rewrites a text file in place and answers its fresh info", () => {
    const root = temp();
    const file = join(root, "notes.md");
    writeFileSync(file, "before\n");
    const info = writeTextFile(file, null, "after\n");
    expect(readFileSync(file, "utf8")).toBe("after\n");
    expect(info).toMatchObject({ path: file, name: "notes.md", kind: "text", size: 6 });
  });

  it("reads a relative path from the pane's folder", () => {
    const root = temp();
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "a.txt"), "x");
    writeTextFile("docs/a.txt", root, "y");
    expect(readFileSync(join(root, "docs", "a.txt"), "utf8")).toBe("y");
  });

  it("refuses a missing file, a binary file and an oversized body, leaving the file untouched", () => {
    const root = temp();
    const blob = join(root, "blob");
    writeFileSync(blob, Buffer.from([1, 0, 2]));
    const big = join(root, "big.txt");
    writeFileSync(big, "small");
    const cases: Array<[() => unknown, string, number]> = [
      [() => writeTextFile(join(root, "missing.txt"), null, "x"), "not_found", 404],
      [() => writeTextFile(blob, null, "x"), "not_text", 415],
      [() => writeTextFile(big, null, "a".repeat(MAX_TEXT_WRITE_BYTES + 1)), "too_large", 413],
      [() => writeTextFile("", null, "x"), "invalid_path", 400],
    ];
    for (const [run, code, status] of cases) {
      try { run(); throw new Error("the write should have been refused"); }
      catch (error) {
        expect(error).toBeInstanceOf(FileWriteError);
        expect((error as FileWriteError).code).toBe(code);
        expect((error as FileWriteError).status).toBe(status);
      }
    }
    expect(readFileSync(big, "utf8")).toBe("small");
  });
});

describe("locateFile", () => {
  const roots: string[] = [];
  afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

  it("finds a bare name deeper in the pane's folder, and lists several of that name", async () => {
    const { mkdirSync } = await import("node:fs");
    const { locateFile } = await import("./file-view.ts");
    const { clearFileCache } = await import("./files.ts");
    const root = mkdtempSync(join(tmpdir(), "herdr-locate-")); roots.push(root);
    mkdirSync(join(root, "docs/screenshots"), { recursive: true });
    mkdirSync(join(root, "a"), { recursive: true });
    mkdirSync(join(root, "b"), { recursive: true });
    writeFileSync(join(root, "docs/screenshots/demo.mp4"), "x");
    writeFileSync(join(root, "a/notes.md"), "a");
    writeFileSync(join(root, "b/notes.md"), "b");
    clearFileCache();
    expect(locateFile("demo.mp4", root)).toMatchObject({ info: { path: join(root, "docs/screenshots/demo.mp4") } });
    expect(locateFile("screenshots/demo.mp4", root)).toMatchObject({ info: { name: "demo.mp4" } });
    expect(locateFile("notes.md", root)).toEqual({ candidates: [join(root, "a/notes.md"), join(root, "b/notes.md")] });
    expect(locateFile("missing.txt", root)).toBeNull();
    // an absolute or ~ path is taken as written, never searched for
    expect(locateFile("/nowhere/demo.mp4", root)).toBeNull();
  });
});
