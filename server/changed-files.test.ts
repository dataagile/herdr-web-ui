import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { fileChanges } from "../shared/file-changes.ts";
import type { ConversationTurn } from "../shared/protocol.ts";
import { ChangedFileNotListed, cachedSessionEdits, changedFileDiff, forgetChangedFiles, gitChanges, parsePorcelain, sessionEdits, type PaneChanges } from "./changed-files.ts";
import { parseClaudeTranscript } from "./conversation.ts";
import { parseCodexTranscript } from "./codex.ts";
import { parseOmpTranscript } from "./transcript-records.ts";

const jsonl = (...records: unknown[]) => records.map((record) => JSON.stringify(record)).join("\n");
const T = (minute: number) => `2026-10-08T10:${String(minute).padStart(2, "0")}:00.000Z`;

const claudeUse = (id: string, name: string, input: unknown, minute: number, cwd?: string) =>
  ({ type: "assistant", timestamp: T(minute), ...(cwd === undefined ? {} : { cwd }), message: { role: "assistant", content: [{ type: "tool_use", id, name, input }] } });
const claudeResult = (id: string, minute: number, isError = false, content = "ok") =>
  ({ type: "user", timestamp: T(minute), message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content, is_error: isError }] } });
const claudePrompt = (text: string, minute: number) => ({ type: "user", timestamp: T(minute), message: { role: "user", content: text } });

describe("changed files: Claude transcript", () => {
  const turns = parseClaudeTranscript(jsonl(
    claudePrompt("fix it", 0),
    claudeUse("a", "Edit", { file_path: "/w/src/a.ts", old_string: "one", new_string: "two" }, 1), claudeResult("a", 1),
    claudeUse("b", "Edit", { file_path: "/w/src/a.ts", old_string: "two", new_string: "three" }, 2), claudeResult("b", 2),
    claudeUse("c", "Write", { file_path: "/w/src/new.ts", content: "hello\n" }, 3), claudeResult("c", 3),
    claudeUse("d", "MultiEdit", { file_path: "src/rel.ts", edits: [{ old_string: "x", new_string: "y" }, { old_string: "p", new_string: "q" }] }, 4), claudeResult("d", 4),
    claudeUse("e", "Edit", { file_path: "/w/src/failed.ts", old_string: "x", new_string: "y" }, 5), claudeResult("e", 5, true),
    claudeUse("f", "Read", { file_path: "/w/src/read.ts" }, 6), claudeResult("f", 6),
    claudeUse("g", "Bash", { command: "echo hi > /w/src/shell.ts" }, 7), claudeResult("g", 7),
    claudeUse("h", "mcp__files__edit_all", { file_path: "/w/src/mcp.ts" }, 8), claudeResult("h", 8),
  ));
  const files = sessionEdits(turns, "/w");

  it("counts the calls that changed each file and marks the one a write made", () => {
    expect([...files.keys()].sort()).toEqual(["/w/src/a.ts", "/w/src/new.ts", "/w/src/rel.ts"]);
    expect(files.get("/w/src/a.ts")).toMatchObject({ created: false });
    expect(files.get("/w/src/a.ts")!.edits).toHaveLength(2);
    // the result says nothing about whether the file existed: git's letter decides later
    expect(files.get("/w/src/new.ts")).toMatchObject({ created: null });
    expect(files.get("/w/src/new.ts")!.edits[0]!.body).toEqual({ kind: "write", content: "hello\n" });
  });

  it("resolves a relative path against the agent's folder and keeps a MultiEdit's pairs", () => {
    expect(files.get("/w/src/rel.ts")!.edits[0]!.body).toEqual({ kind: "replace", edits: [{ before: "x", after: "y" }, { before: "p", after: "q" }] });
  });

  it("ignores a failed call, a read, a shell command and a tool the verb table does not know", () => {
    for (const path of ["/w/src/failed.ts", "/w/src/read.ts", "/w/src/shell.ts", "/w/src/mcp.ts"]) expect(files.has(path)).toBe(false);
  });

  it("keeps the turn's time", () => {
    expect(files.get("/w/src/a.ts")!.edits[0]!.at).toBe(T(1));
    expect(files.get("/w/src/a.ts")!.last_at).toBe(T(8));
  });
});

describe("changed files: a whole-file write is created only when the file was not there", () => {
  const turns = parseClaudeTranscript(jsonl(
    claudePrompt("go", 0),
    claudeUse("a", "Write", { file_path: "/w/made.ts", content: "x" }, 1), claudeResult("a", 1, false, "File created successfully at: /w/made.ts"),
    claudeUse("b", "Write", { file_path: "/w/over.ts", content: "x" }, 2), claudeResult("b", 2, false, "The file /w/over.ts has been updated. Here's the result"),
    claudeUse("c", "Edit", { file_path: "/w/made.ts", old_string: "x", new_string: "y" }, 3), claudeResult("c", 3),
    claudeUse("d", "Edit", { file_path: "/w/over.ts", old_string: "x", new_string: "y" }, 4), claudeResult("d", 4),
  ));
  const files = sessionEdits(turns, "/w");
  it("reads the result of the first call", () => {
    expect(files.get("/w/made.ts")!.created).toBe(true);
    expect(files.get("/w/over.ts")!.created).toBe(false);
    expect(files.get("/w/over.ts")!.edits).toHaveLength(2);
  });
});

describe("changed files: the folder a call ran in", () => {
  it("resolves a Claude relative path against the record's cwd", () => {
    const turns = parseClaudeTranscript(jsonl(
      claudePrompt("go", 0),
      claudeUse("a", "Edit", { file_path: "rel.ts", old_string: "x", new_string: "y" }, 1, "/w/sub"), claudeResult("a", 1),
      claudeUse("b", "Edit", { file_path: "rel2.ts", old_string: "x", new_string: "y" }, 2), claudeResult("b", 2),
    ));
    expect([...sessionEdits(turns, "/pane").keys()].sort()).toEqual(["/pane/rel2.ts", "/w/sub/rel.ts"]);
  });

  it("records a Codex call's folder: the exec's workdir (relative to the session's), else the session's", () => {
    const item = (payload: unknown) => ({ type: "response_item", timestamp: T(1), payload });
    const patch = "*** Begin Patch\n*** Update File: a.ts\n@@\n-1\n+2\n*** End Patch";
    const turns = parseCodexTranscript(jsonl(
      { type: "session_meta", payload: { id: "t", cwd: "/session" } },
      item({ type: "message", role: "user", content: [{ type: "input_text", text: "go" }] }),
      item({ type: "custom_tool_call", call_id: "p1", name: "apply_patch", input: patch }),
      item({ type: "custom_tool_call_output", call_id: "p1", output: "Success" }),
      item({ type: "function_call", call_id: "s1", name: "exec_command", arguments: JSON.stringify({ cmd: "ls", workdir: "nested" }) }),
      item({ type: "function_call", call_id: "s2", name: "exec_command", arguments: JSON.stringify({ cmd: "ls", workdir: "/elsewhere" }) }),
      { type: "turn_context", payload: { cwd: "/moved" } },
      item({ type: "custom_tool_call", call_id: "p2", name: "apply_patch", input: patch.replace("a.ts", "b.ts") }),
      item({ type: "custom_tool_call_output", call_id: "p2", output: "Success" }),
    ), Infinity);
    const folders = turns.flatMap((turn) => turn.parts.flatMap((part) => part.kind === "tool" ? [part.cwd] : []));
    expect(folders).toEqual(["/session", "/session/nested", "/elsewhere", "/moved"]);
    expect([...sessionEdits(turns, "/pane").keys()]).toEqual(["/session/a.ts", "/moved/b.ts"]);
  });

  it("falls back to the pane's folder when the transcript records none", () => {
    const item = (payload: unknown) => ({ type: "response_item", timestamp: T(1), payload });
    const turns = parseCodexTranscript(jsonl(
      item({ type: "message", role: "user", content: [{ type: "input_text", text: "go" }] }),
      item({ type: "custom_tool_call", call_id: "p1", name: "apply_patch", input: "*** Begin Patch\n*** Update File: a.ts\n@@\n-1\n+2\n*** End Patch" }),
      item({ type: "custom_tool_call_output", call_id: "p1", output: "Success" }),
    ), Infinity);
    expect([...sessionEdits(turns, "/pane").keys()]).toEqual(["/pane/a.ts"]);
  });

  it("keeps the part's cwd out of the way of an absolute path", () => {
    const turns = parseClaudeTranscript(jsonl(claudePrompt("go", 0),
      claudeUse("a", "Edit", { file_path: "/abs.ts", old_string: "x", new_string: "y" }, 1, "/w/sub"), claudeResult("a", 1)));
    expect([...sessionEdits(turns, "/pane").keys()]).toEqual(["/abs.ts"]);
  });
});

describe("changed files: a Codex script that failed", () => {
  const item = (payload: unknown) => ({ type: "response_item", timestamp: T(1), payload });
  const patch = "*** Begin Patch\n*** Update File: /abs/s.ts\n@@\n-1\n+2\n*** End Patch";
  const turns = parseCodexTranscript(jsonl(
    item({ type: "message", role: "user", content: [{ type: "input_text", text: "go" }] }),
    item({ type: "custom_tool_call", call_id: "x1", name: "exec", input: `tools.apply_patch(${JSON.stringify(patch)}); throw new Error("later")` }),
    item({ type: "custom_tool_call_output", call_id: "x1", output: "Script failed\nError: later" }),
    item({ type: "custom_tool_call", call_id: "x2", name: "exec", input: `tools.apply_patch(${JSON.stringify(patch.replace("/abs/s.ts", "/abs/v.ts"))})` }),
    item({ type: "custom_tool_call_output", call_id: "x2", output: "Script failed\napply_patch verification failed: no such file" }),
    item({ type: "custom_tool_call", call_id: "x3", name: "apply_patch", input: patch.replace("/abs/s.ts", "/abs/b.ts") }),
    item({ type: "custom_tool_call_output", call_id: "x3", output: "Script failed" }),
  ), Infinity);
  const files = sessionEdits(turns, "/w");
  it("keeps the patch's edits, marked uncertain, unless the patch itself was refused", () => {
    expect(turns[0]!.parts.every((part) => part.kind !== "tool" || part.error === true)).toBe(true);
    expect([...files.keys()]).toEqual(["/abs/s.ts"]);
    expect(files.get("/abs/s.ts")).toMatchObject({ uncertain: true });
  });
  it("still skips a Claude Edit the tool refused", () => {
    const claude = parseClaudeTranscript(jsonl(claudePrompt("go", 0),
      claudeUse("a", "Edit", { file_path: "/w/r.ts", old_string: "x", new_string: "y" }, 1), claudeResult("a", 1, true, "refused")));
    expect(sessionEdits(claude, "/w").size).toBe(0);
  });
});

describe("changed files: a patch that moves a file", () => {
  it("attributes the new name as created, and the old one as changed", () => {
    const patch = "*** Begin Patch\n*** Update File: old/a.ts\n*** Move to: new/a.ts\n@@\n-1\n+2\n*** End Patch";
    const changes = fileChanges("apply_patch", patch);
    expect(changes.map((change) => [change.path, change.created])).toEqual([["old/a.ts", false], ["new/a.ts", true]]);
    expect(changes[1]!.body).toMatchObject({ kind: "patch", action: "Update" });
  });
});

describe("changed files: Codex rollout", () => {
  const item = (payload: unknown, timestamp = T(1)) => ({ type: "response_item", timestamp, payload });
  const message = (role: string, text: string) => item({ type: "message", role, content: [{ type: role === "user" ? "input_text" : "output_text", text }] });
  const patch = [
    "*** Begin Patch",
    "*** Update File: src/a.ts", "@@", "-old", "+new",
    "*** Add File: src/b.ts", "+fresh",
    "*** Delete File: src/c.ts",
    "*** End Patch",
  ].join("\n");
  const turns = parseCodexTranscript(jsonl(
    message("user", "go"),
    item({ type: "custom_tool_call", call_id: "p1", name: "apply_patch", input: patch }),
    item({ type: "custom_tool_call_output", call_id: "p1", output: "Success" }),
    item({ type: "custom_tool_call", call_id: "p2", name: "exec", input: `tools.apply_patch(${JSON.stringify("*** Begin Patch\n*** Update File: /abs/d.ts\n@@\n-1\n+2\n*** End Patch")})` }),
    item({ type: "custom_tool_call_output", call_id: "p2", output: "ok" }),
    item({ type: "function_call", call_id: "p3", name: "exec_command", arguments: '{"cmd":"git status"}' }),
    item({ type: "function_call_output", call_id: "p3", output: "clean" }),
  ), Infinity);
  const files = sessionEdits(turns, "/w");

  it("reads every file a patch names, with what the patch does to it", () => {
    expect(files.get("/w/src/a.ts")).toMatchObject({ created: false });
    expect(files.get("/w/src/a.ts")!.edits[0]!.body).toMatchObject({ kind: "patch", action: "Update", lines: ["@@", "-old", "+new"] });
    expect(files.get("/w/src/b.ts")).toMatchObject({ created: true });
    expect(files.get("/w/src/c.ts")!.edits[0]!.body).toMatchObject({ kind: "patch", action: "Delete" });
  });

  it("reads a patch an exec script applies, and an absolute path stays itself", () => {
    expect(files.get("/abs/d.ts")!.edits).toHaveLength(1);
    expect([...files.keys()]).toHaveLength(4);
  });
});

describe("changed files: pi, omp, gjc and omo records", () => {
  const call = (id: string, name: string, args: unknown, minute: number) =>
    ({ type: "message", timestamp: T(minute), message: { role: "assistant", content: [{ type: "toolCall", id, name, arguments: args }] } });
  const result = (id: string, minute: number) => ({ type: "message", timestamp: T(minute), message: { role: "toolResult", toolCallId: id, content: [{ type: "text", text: "ok" }] } });
  const turns = parseOmpTranscript(jsonl(
    { type: "message", timestamp: T(0), message: { role: "user", content: [{ type: "text", text: "go" }] } },
    call("1", "edit", { path: "/w/a.ts", oldText: "x", newText: "y" }, 1), result("1", 1),
    call("2", "write", { path: "/w/b.ts", content: "z" }, 2), result("2", 2),
    call("3", "edit", { path: "/w/c.ts", input: "PUT 3\n+line" }, 3), result("3", 3),
    call("4", "edit", { path: "/w/d.ts", edits: [{ oldText: "a", newText: "b" }] }, 4), result("4", 4),
    call("5", "bash", { command: "echo > /w/e.ts" }, 5), result("5", 5),
    call("6", "read", { path: "/w/f.ts" }, 6), result("6", 6),
  ), Infinity);
  const files = sessionEdits(turns, "/w");

  it("reads old/new text, writes, edit scripts and edit lists", () => {
    expect(files.get("/w/a.ts")!.edits[0]!.body).toEqual({ kind: "replace", edits: [{ before: "x", after: "y" }] });
    expect(files.get("/w/b.ts")).toMatchObject({ created: null });
    expect(files.get("/w/c.ts")!.edits[0]!.body).toEqual({ kind: "script", script: "PUT 3\n+line" });
    expect(files.get("/w/d.ts")!.edits[0]!.body).toEqual({ kind: "replace", edits: [{ before: "a", after: "b" }] });
  });

  it("ignores commands and reads", () => {
    expect([...files.keys()].sort()).toEqual(["/w/a.ts", "/w/b.ts", "/w/c.ts", "/w/d.ts"]);
  });
});

describe("changed files: classifier", () => {
  it("gives no change to a call whose input names no file or is not JSON", () => {
    expect(fileChanges("Edit", "not json")).toEqual([]);
    expect(fileChanges("Edit", "{}")).toEqual([]);
    expect(fileChanges("Grep", '{"path":"/x"}')).toEqual([]);
  });
});

describe("changed files: git status", () => {
  it("parses porcelain -z, with a rename's old name and a name with spaces", () => {
    const out = [" M src/a.ts", "A  src/b.ts", "?? new file.txt", " D gone.ts", "R  to.ts", "from.ts", "MM both.ts", "!! ignored.log"].join("\0") + "\0";
    expect(parsePorcelain(out)).toEqual([
      { path: "src/a.ts", status: "M" }, { path: "src/b.ts", status: "A" }, { path: "new file.txt", status: "?" },
      { path: "gone.ts", status: "D" }, { path: "to.ts", status: "R" }, { path: "both.ts", status: "M" },
    ]);
  });
});

describe("changed files: cache", () => {
  it("parses a transcript once per state of the file", () => {
    forgetChangedFiles();
    let reads = 0;
    const read = (): ConversationTurn[] => { reads++; return []; };
    cachedSessionEdits("/t.jsonl", "1:1:10:1", "/w", read);
    cachedSessionEdits("/t.jsonl", "1:1:10:1", "/w", read);
    expect(reads).toBe(1);
    cachedSessionEdits("/t.jsonl", "1:1:20:2", "/w", read);
    expect(reads).toBe(2);
    cachedSessionEdits("/t.jsonl", "1:1:20:2", "/other", read);
    expect(reads).toBe(3);
  });
});

describe("changed files: a real repo", () => {
  let dir: string;
  const run = (...args: string[]) => {
    const done = Bun.spawnSync(["git", "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { stdout: "pipe", stderr: "pipe" });
    if (done.exitCode !== 0) throw new Error(done.stderr.toString());
  };
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "herdr-changed-"));
    run("init", "-q");
    writeFileSync(join(dir, "tracked.txt"), "one\ntwo\n");
    writeFileSync(join(dir, "other.txt"), "keep\n");
    run("add", "."); run("commit", "-q", "-m", "init");
    writeFileSync(join(dir, "tracked.txt"), "one\nTWO\n");
    writeFileSync(join(dir, "other.txt"), "kept\n");
    writeFileSync(join(dir, "fresh.txt"), "brand new\n");
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("lists what git sees changed, with the repo root", async () => {
    const found = await gitChanges(dir);
    expect(found).not.toBeNull();
    const byName = Object.fromEntries(found!.changes.map((change) => [change.path.split("/").pop(), change.status]));
    expect(byName).toMatchObject({ "tracked.txt": "M", "other.txt": "M", "fresh.txt": "?" });
  });

  it("returns no list at all when git's output was cut", async () => {
    const found = await gitChanges(dir, 20);
    expect(found).toMatchObject({ changes: [], truncated: true });
    expect((await gitChanges(dir))!.truncated).toBe(false);
  });

  it("is no repo outside a work tree", async () => {
    const plain = mkdtempSync(join(tmpdir(), "herdr-plain-"));
    try { expect(await gitChanges(plain)).toBeNull(); } finally { rmSync(plain, { recursive: true, force: true }); }
  });

  async function listed(sessionPaths: string[]): Promise<PaneChanges> {
    const found = (await gitChanges(dir))!;
    const edits = new Map(sessionPaths.map((path) => [path, { path, created: false as boolean | null, last_at: null, edits: [{ at: T(1), body: { kind: "write" as const, content: "x" } }] }]));
    return {
      root: found.root, edits,
      report: {
        repo: true,
        session: sessionPaths.map((path) => ({ path, rel: path, exists: true, edits: 1, created: false, last_at: null })),
        git: found.changes.map((change) => ({ path: change.path, rel: change.path, exists: true, git: change.status })),
      },
    };
  }

  it("diffs a git-only file, tracked or not", async () => {
    const changes = await listed([]);
    const tracked = changes.report.git.find((file) => file.path.endsWith("tracked.txt"))!;
    const diff = await changedFileDiff(changes, tracked.path);
    expect(diff).toMatchObject({ kind: "git", truncated: false });
    expect(diff.kind === "git" && diff.diff).toContain("+TWO");
    const fresh = changes.report.git.find((file) => file.path.endsWith("fresh.txt"))!;
    const created = await changedFileDiff(changes, fresh.path);
    expect(created.kind === "git" && created.diff).toContain("+brand new");
  });

  it("answers a session file with the transcript's edits, never with git", async () => {
    const changes = await listed(["/not/in/repo.ts"]);
    const diff = await changedFileDiff(changes, "/not/in/repo.ts");
    expect(diff).toMatchObject({ kind: "session", edits: [{ at: T(1), body: { kind: "write" } }] });
  });

  it("refuses a path the list did not name", async () => {
    const changes = await listed([]);
    for (const path of ["/etc/passwd", join(dir, "..", "..", "etc", "passwd"), join(dir, "tracked.txt", "..", "..", "x"), join(dir, "unchanged-or-unknown.txt"), ""]) {
      await expect(changedFileDiff(changes, path)).rejects.toBeInstanceOf(ChangedFileNotListed);
    }
  });
});
