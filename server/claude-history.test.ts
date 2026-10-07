import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { claudeHistory, forgetClaudeHistory, insideFolder } from "./claude-history.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const D = "44444444-4444-4444-8444-444444444444";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "claude-history-")); forgetClaudeHistory(); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function line(entry: Record<string, unknown>): string { return JSON.stringify(entry); }
function user(content: unknown, extra: Record<string, unknown> = {}): string {
  return line({ type: "user", cwd: "/work/app", gitBranch: "main", entrypoint: "cli", message: { role: "user", content }, ...extra });
}

/** A transcript `ageMs` old, in the project directory `project`. */
function write(project: string, id: string, lines: string[], ageMs = 0): string {
  mkdirSync(join(dir, "projects", project), { recursive: true });
  const path = join(dir, "projects", project, `${id}.jsonl`);
  writeFileSync(path, `${lines.join("\n")}\n`);
  const when = new Date(Date.now() - ageMs);
  utimesSync(path, when, when);
  return path;
}

const query = () => ({ configDir: dir, folders: ["/work/app"], since: 0, automated: false, offset: 0, limit: 50 });

describe("claudeHistory", () => {
  it("titles a session by its /rename, else by its first real prompt", async () => {
    write("p", A, [user("<local-command-caveat>x</local-command-caveat>"), user([{ type: "tool_result", content: "r" }]), user("<system-reminder>r</system-reminder>"), user("Fix   the\nlogin bug"), line({ type: "custom-title", customTitle: "login-fix" })]);
    write("p", B, [user("<command-name>/clear</command-name>"), user("Add a report"), user("second prompt")], 1000);
    const { sessions } = await claudeHistory(query());
    expect(sessions.map((s) => [s.session_id, s.title, s.first_prompt])).toEqual([
      [A, "login-fix", "Fix the login bug"],
      [B, "Add a report", "Add a report"],
    ]);
    expect(sessions[0]).toMatchObject({ git_branch: "main", cwd: "/work/app", automated: false, prompt_count: 1 });
  });

  it("reads a /rename and the model from the tail of a big transcript", async () => {
    const filler = line({ type: "attachment", cwd: "/work/app", text: "x".repeat(1000) });
    write("p", A, [user("hello"), ...Array(400).fill(filler), line({ type: "assistant", message: { model: "claude-opus-5-5" } }), line({ type: "custom-title", customTitle: "late name" })]);
    const { sessions } = await claudeHistory(query());
    expect(sessions[0]).toMatchObject({ title: "late name", first_prompt: "hello", model: "claude-opus-5-5", prompt_count: 1 });
  });

  it("finds the folder past the first chunk, and a line that straddles a chunk edge", async () => {
    // the first line with a folder starts after 300 KB of attachments that name none (past the whole-file read)
    write("p", A, [line({ type: "attachment", text: "x".repeat(300 * 1024) }), user("late folder")]);
    // 180 KB: head and tail meet in one read, a prompt line crossing the 128 KiB mark stays whole
    write("p", B, [user("first"), line({ type: "attachment", cwd: "/work/app", text: "y".repeat(128 * 1024 - 400) }), user("straddling prompt"), line({ type: "custom-title", customTitle: "kept" }), line({ type: "attachment", text: "z".repeat(50 * 1024) })], 1000);
    const { sessions } = await claudeHistory(query());
    expect(sessions.map((s) => [s.session_id, s.first_prompt])).toEqual([[A, "late folder"], [B, "first"]]);
    expect(sessions[1]!.title).toBe("kept");
  });

  it("drops the count of a transcript too big to read whole", async () => {
    write("p", A, [user("small")]);
    write("p", C, [user("huge"), line({ type: "attachment", text: "z".repeat(5 * 1024 * 1024) })], 1000);
    const { sessions } = await claudeHistory(query());
    expect(sessions.map((s) => [s.session_id, s.prompt_count])).toEqual([[A, 1], [C, null]]);
  });

  it("takes a /rename and the model of a small transcript from the whole file, skipping side chains", async () => {
    write("p", A, [
      user("first"), line({ type: "assistant", message: { model: "claude-opus-5-5" } }),
      line({ type: "custom-title", customTitle: "mid rename" }),
      user("sidechain prompt", { isSidechain: true }), line({ type: "assistant", isSidechain: true, message: { model: "claude-haiku-4-5" } }),
      user([{ type: "tool_result", content: "r" }]), user("second"),
    ]);
    const { sessions } = await claudeHistory(query());
    expect(sessions[0]).toMatchObject({ title: "mid rename", model: "claude-opus-5-5", prompt_count: 2 });
  });

  it("looks in the project directories named for the folders, and in all of them when none is", async () => {
    write("-work-app", A, [user("in its own project")]);
    write("-work-app-wt", B, [user("in a worktree project", { cwd: "/work/app/wt" })], 1000);
    write("-work-app-src", D, [user("started in a subfolder", { cwd: "/work/app/src" })], 1500);
    write("-work-app2", "55555555-5555-4555-8555-555555555555", [user("a sibling folder's project")], 1800);
    write("elsewhere", C, [user("same cwd, other directory")], 2000);
    expect((await claudeHistory(query())).sessions.map((s) => s.session_id)).toEqual([A, B, D]);
    forgetClaudeHistory();
    expect((await claudeHistory({ ...query(), folders: ["/nowhere"] })).sessions).toEqual([]);
    expect((await claudeHistory({ ...query(), folders: ["/work/app", "/unnamed"] })).sessions.map((s) => s.session_id)).toEqual([A, B, D]);
  });

  it("hides claude -p sessions unless asked", async () => {
    write("p", A, [user("headless review", { entrypoint: "sdk-cli" })]);
    write("p", B, [user("interactive")], 1000);
    expect((await claudeHistory(query())).sessions.map((s) => s.session_id)).toEqual([B]);
    const all = (await claudeHistory({ ...query(), automated: true })).sessions;
    expect(all.map((s) => [s.session_id, s.automated])).toEqual([[A, true], [B, false]]);
  });

  it("matches the folder and the folders below it, wherever the project directory is", async () => {
    write("p1", A, [user("here")]);
    write("whatever", B, [user("below", { cwd: "/work/app/wt/feature" })], 1000);
    write("p1", C, [user("sibling", { cwd: "/work/app-other" })], 2000);
    write("p1", D, [user("elsewhere", { cwd: "/work" })], 3000);
    expect((await claudeHistory(query())).sessions.map((s) => s.session_id)).toEqual([A, B]);
  });

  it("treats every sdk- entrypoint as automated and matches any of several folders", async () => {
    write("p", A, [user("sdk ts", { entrypoint: "sdk-ts" })]);
    write("q", B, [user("sibling worktree", { cwd: "/work/app-feature/src" })], 1000);
    expect((await claudeHistory({ ...query(), folders: ["/work/app", "/work/app-feature"] })).sessions.map((s) => s.session_id)).toEqual([B]);
    expect((await claudeHistory({ ...query(), automated: true, folders: ["/work/app", "/work/app-feature"] })).sessions.map((s) => s.session_id)).toEqual([A, B]);
  });

  it("filters by last activity before reading, newest first", async () => {
    write("p", A, [user("old")], 10 * 86_400_000);
    write("p", B, [user("recent")], 1000);
    expect((await claudeHistory({ ...query(), since: Date.now() - 86_400_000 })).sessions.map((s) => s.session_id)).toEqual([B]);
    expect((await claudeHistory(query())).sessions.map((s) => s.session_id)).toEqual([B, A]);
  });

  it("pages with has_more", async () => {
    for (const [index, id] of [A, B, C].entries()) write("p", id, [user(`prompt ${index}`)], index * 1000);
    const first = await claudeHistory({ ...query(), limit: 2 });
    expect([first.sessions.map((s) => s.session_id), first.has_more]).toEqual([[A, B], true]);
    const second = await claudeHistory({ ...query(), limit: 2, offset: 2 });
    expect([second.sessions.map((s) => s.session_id), second.has_more]).toEqual([[C], false]);
  });

  it("reads only session files inside the store: no symlink, no odd names, no store", async () => {
    mkdirSync(join(dir, "outside"));
    writeFileSync(join(dir, "outside", `${A}.jsonl`), `${user("secret")}\n`);
    mkdirSync(join(dir, "projects", "p"), { recursive: true });
    symlinkSync(join(dir, "outside", `${A}.jsonl`), join(dir, "projects", "p", `${A}.jsonl`));
    symlinkSync(join(dir, "outside"), join(dir, "projects", "linked"));
    write("p", "not-a-uuid", [user("odd name")]);
    expect((await claudeHistory(query())).sessions).toEqual([]);
    expect((await claudeHistory({ ...query(), configDir: join(dir, "missing") })).sessions).toEqual([]);
  });

  it("shows a transcript with no prompt as untitled, and skips one with no folder", async () => {
    write("p", A, [line({ type: "attachment", cwd: "/work/app" })]);
    write("p", B, [line({ type: "user", message: { content: "no cwd" } })], 1000);
    const { sessions } = await claudeHistory(query());
    expect(sessions.map((s) => [s.session_id, s.title])).toEqual([[A, ""]]);
  });
});

describe("insideFolder", () => {
  it("is the folder or a path below it, by whole names", () => {
    expect(insideFolder("/a/b", "/a/b")).toBe(true);
    expect(insideFolder("/a/b/c", "/a/b/")).toBe(true);
    expect(insideFolder("/a/bc", "/a/b")).toBe(false);
    expect(insideFolder("/anything", "/")).toBe(true);
    expect(insideFolder("C:\\w\\app\\sub", "C:\\w\\app")).toBe(true);
  });
});
