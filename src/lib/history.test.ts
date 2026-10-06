import { describe, expect, it } from "bun:test";

import type { HistorySession } from "../../shared/protocol.ts";
import { groupByDay, matchingSessions, openPaneOf, projectFolder, resumeArgs, resumeCommand, resumeCommandIn, sinceFor } from "./history.ts";

const session = (id: string, last_activity: number, title = id, first_prompt = ""): HistorySession => ({ session_id: id, title, first_prompt, last_activity, message_count: 1, git_branch: null, model: null, cwd: "/w", automated: false });
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe("history ranges", () => {
  it("Today reaches back to local midnight, the others roll", () => {
    const now = at(2026, 10, 6, 18);
    expect(sinceFor("today", now)).toBe(at(2026, 10, 6, 0));
    expect(sinceFor("7d", now)).toBe(now - 7 * 86_400_000);
    expect(sinceFor("30d", now)).toBe(now - 30 * 86_400_000);
  });

  it("groups by local day, naming today and yesterday", () => {
    const now = at(2026, 10, 6, 18);
    const groups = groupByDay([session("a", at(2026, 10, 6, 15)), session("b", at(2026, 10, 6, 9)), session("c", at(2026, 10, 5, 23)), session("d", at(2026, 10, 1))], now);
    expect(groups.map((g) => [g.kind, g.sessions.map((s) => s.session_id)])).toEqual([["today", ["a", "b"]], ["yesterday", ["c"]], ["date", ["d"]]]);
  });

  it("searches title and first prompt", () => {
    const list = [session("a", 1, "login-fix", "Fix the bug"), session("b", 2, "report", "Add LOGIN page")];
    expect(matchingSessions(list, "login").map((s) => s.session_id)).toEqual(["a", "b"]);
    expect(matchingSessions(list, "  ").length).toBe(2);
    expect(matchingSessions(list, "nothing")).toEqual([]);
  });
});

describe("resume", () => {
  it("adds the saved claude arguments after --resume", () => {
    expect(resumeArgs("abc", "--dangerously-skip-permissions --model 'a b'")).toEqual(["--resume", "abc", "--dangerously-skip-permissions", "--model", "a b"]);
    expect(resumeCommand("abc", "")).toBe("claude --resume abc");
    expect(resumeCommand("abc", "--model 'a b'")).toBe("claude --resume abc --model 'a b'");
  });

  it("copies with the folder, quoted", () => {
    expect(resumeCommandIn("/w/my app", "abc", "")).toBe("cd '/w/my app' && claude --resume abc");
    expect(resumeCommandIn("/w/it's", "abc", "")).toBe("cd '/w/it'\\''s' && claude --resume abc");
  });
});

describe("open sessions", () => {
  const panes = [
    { pane_id: "p1", agent: "claude", agent_session: { agent: "claude", kind: "id", source: "hook", value: "ABC" } },
    { pane_id: "p2", agent: "codex", agent_session: { agent: "codex", kind: "id", source: "hook", value: "def" } },
    { pane_id: "p3", agent: "claude", agent_session: { agent: "claude", kind: "path", source: "x", value: "ghi" } },
    { pane_id: "p4", agent: "claude", agent_session: null },
  ];
  it("finds the claude pane that reports the id", () => {
    expect(openPaneOf("abc", panes)).toBe("p1");
    expect(openPaneOf("def", panes)).toBeNull();
    expect(openPaneOf("ghi", panes)).toBeNull();
  });
});

describe("projectFolder", () => {
  it("is a worktree's checkout, else the first pane's folder", () => {
    const panes = [{ workspace_id: "w2", cwd: "/x" }, { workspace_id: "w1", cwd: null }, { workspace_id: "w1", cwd: "/a" }];
    expect(projectFolder({ workspace_id: "w1" }, panes)).toBe("/a");
    expect(projectFolder({ workspace_id: "w1", worktree: { checkout_path: "/wt", is_linked_worktree: true, repo_key: "", repo_name: "", repo_root: "" } }, panes)).toBe("/wt");
    expect(projectFolder({ workspace_id: "w9" }, panes)).toBeNull();
  });
});
