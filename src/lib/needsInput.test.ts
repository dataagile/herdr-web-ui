import { expect, it } from "bun:test";
import type { Machine } from "../../shared/machines.ts";
import type { SessionSnapshot } from "../../shared/protocol.ts";
import { panesNeedingYou } from "./needsInput.ts";

function machine(id: string, state: Machine["state"] = "connected"): Machine {
  return { id, name: id, kind: "ssh", enabled: true, state, error: null, snapshot: {
    workspaces: [{ workspace_id: "second", label: "Second" }, { workspace_id: "first", label: "First" }],
    panes: [
      { workspace_id: "first", pane_id: "first-done", agent_status: "done" },
      { workspace_id: "first", pane_id: "same-id", agent_status: "blocked" },
      { workspace_id: "second", pane_id: "running", agent_status: "working" },
      { workspace_id: "second", pane_id: "idle", agent_status: "idle" },
      { workspace_id: "second", pane_id: "second-done", agent_status: "done" },
      { workspace_id: "second", pane_id: "waiting", agent_status: "blocked" },
    ],
  } as SessionSnapshot };
}

it("lists blocked panes first, then done, each in workspace order, without changing the roster", () => {
  const m = machine("local");
  const before = JSON.stringify(m);
  expect(panesNeedingYou(m).map(({ pane }) => pane.pane_id)).toEqual(["waiting", "same-id", "second-done", "first-done"]);
  expect(panesNeedingYou(m).map(({ workspace }) => workspace.label)).toEqual(["Second", "First", "Second", "First"]);
  expect(JSON.stringify(m)).toBe(before);
});

it("keeps each PC to its own panes", () => {
  const other = machine("remote");
  other.snapshot!.panes = other.snapshot!.panes.filter((pane) => pane.pane_id === "waiting");
  expect(panesNeedingYou(other).map(({ pane }) => pane.pane_id)).toEqual(["waiting"]);
});

it("drops resumed or seen, offline and missing-roster panes", () => {
  const online = machine("online");
  online.snapshot!.panes.forEach((pane) => { pane.agent_status = "idle"; });
  const missing = machine("missing"); missing.snapshot = null;
  for (const m of [online, missing, machine("offline", "disconnected"), machine("reconnecting", "reconnecting")]) expect(panesNeedingYou(m)).toEqual([]);
});

it("lists only blocked panes on a PC whose bridge refuses pane/seen", () => {
  expect(panesNeedingYou(machine("old"), true).map(({ pane }) => pane.pane_id)).toEqual(["waiting", "same-id"]);
});
