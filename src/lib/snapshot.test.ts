import { describe, expect, it } from "bun:test";
import type { AgentStatus, SessionSnapshot } from "../../shared/protocol.ts";
import { applyLayout, applyPaneStatus, LAYOUT_PIN_MS, pinLayouts, type LayoutPin } from "./snapshot.ts";

function snapshotFixture(): SessionSnapshot {
  return {
    protocol: 22,
    version: "test",
    workspaces: [],
    tabs: [],
    layouts: [],
    panes: [
      { pane_id: "w1:p1", workspace_id: "w1", tab_id: "w1:t1", terminal_id: "t1", revision: 1, focused: true, agent_status: "working" },
      { pane_id: "w1:p2", workspace_id: "w1", tab_id: "w1:t1", terminal_id: "t2", revision: 1, focused: false, agent_status: "idle" },
    ],
    agents: [
      { pane_id: "w1:p1", workspace_id: "w1", tab_id: "w1:t1", terminal_id: "t1", revision: 1, focused: true, agent_status: "working" },
    ],
  } as unknown as SessionSnapshot;
}

describe("applyPaneStatus", () => {
  it("updates the pane and its agent entry to the pushed status", () => {
    const current = snapshotFixture();
    const next = applyPaneStatus(current, "w1:p1", "blocked" as AgentStatus);
    expect(next.panes.find((pane) => pane.pane_id === "w1:p1")?.agent_status).toBe("blocked");
    expect(next.agents.find((agent) => agent.pane_id === "w1:p1")?.agent_status).toBe("blocked");
    // untouched panes keep their object identity: React re-renders only what changed
    expect(next.panes.find((pane) => pane.pane_id === "w1:p2")).toBe(current.panes[1]);
  });

  it("carries a pane's background task count, and leaves it alone when a frame says nothing of it", () => {
    const current = snapshotFixture();
    const counted = applyPaneStatus(current, "w1:p1", "working", 2);
    expect(counted.panes.find((pane) => pane.pane_id === "w1:p1")).toMatchObject({ agent_status: "working", background_tasks: 2 });
    // a frame of another source (herdr's own status event) has no count: the one known stays
    const done = applyPaneStatus(counted, "w1:p1", "done" as AgentStatus);
    expect(done.panes.find((pane) => pane.pane_id === "w1:p1")).toMatchObject({ agent_status: "done", background_tasks: 2 });
    expect(applyPaneStatus(done, "w1:p1", "done" as AgentStatus, 2)).toBe(done);
    // none left: the field goes, so the badge does
    const none = applyPaneStatus(done, "w1:p1", "done" as AgentStatus, 0);
    expect("background_tasks" in none.panes.find((pane) => pane.pane_id === "w1:p1")!).toBe(false);
  });

  it("returns the same snapshot object when the status already matches", () => {
    const current = snapshotFixture();
    expect(applyPaneStatus(current, "w1:p1", "working")).toBe(current);
  });

  it("returns the same snapshot object when the pane is unknown", () => {
    const current = snapshotFixture();
    expect(applyPaneStatus(current, "w9:p9", "done" as AgentStatus)).toBe(current);
  });
});

describe("applyLayout", () => {
  const layout = (tab: string, ratio: number) => ({ workspace_id: "w1", tab_id: tab, zoomed: false, area: { x: 0, y: 0, width: 120, height: 40 }, focused_pane_id: "w1:p1", panes: [], splits: [{ id: "s", direction: "right", ratio, rect: { x: 0, y: 0, width: 120, height: 40 } }] });

  it("replaces the tab's own layout and keeps the others", () => {
    const current = { ...snapshotFixture(), layouts: [layout("w1:t1", 0.5), layout("w1:t2", 0.5)] };
    const next = applyLayout(current, layout("w1:t1", 0.6));
    expect(next.layouts.map((entry) => [entry.tab_id, entry.splits[0]!.ratio])).toEqual([["w1:t1", 0.6], ["w1:t2", 0.5]]);
    expect(next.layouts[1]).toBe(current.layouts[1]);
  });

  it("adds a layout the snapshot did not have", () => {
    expect(applyLayout(snapshotFixture(), layout("w1:t1", 0.5)).layouts).toHaveLength(1);
  });
});

describe("pinLayouts", () => {
  const layout = (ratio: number) => ({ workspace_id: "w1", tab_id: "w1:t1", zoomed: false, area: { x: 0, y: 0, width: 120, height: 40 }, focused_pane_id: "w1:p1", panes: [], splits: [{ id: "s", direction: "right", ratio, rect: { x: 0, y: 0, width: 120, height: 40 } }] });
  const remote = (ratio: number) => ({ id: "pc2", snapshot: { ...snapshotFixture(), layouts: [layout(ratio)] } });
  const pin = (ratio: number, at = 1000): Map<string, LayoutPin> => new Map([["pc2:w1:t1", { machineId: "pc2", layout: layout(ratio), at }]]);

  it("keeps a remote PC's answered layout over an older roster", () => {
    const pins = pin(0.7);
    const out = pinLayouts([remote(0.5)], pins, 2000);
    expect(out[0]!.snapshot.layouts[0]!.splits[0]!.ratio).toBe(0.7);
    expect(pins.size).toBe(1);
  });

  it("lets go once the roster carries the same layout, or after the pin's time", () => {
    const settled = pin(0.7);
    const roster = [remote(0.7)];
    expect(pinLayouts(roster, settled, 2000)).toBe(roster);
    expect(settled.size).toBe(0);
    const old = pin(0.7);
    expect(pinLayouts([remote(0.5)], old, 1000 + LAYOUT_PIN_MS + 1)[0]!.snapshot.layouts[0]!.splits[0]!.ratio).toBe(0.5);
    expect(old.size).toBe(0);
  });

  it("drops the pin when a pane was made or closed since", () => {
    const pins = pin(0.7);
    const grown = [{ id: "pc2", snapshot: { ...snapshotFixture(), layouts: [{ ...layout(0.5), panes: [{ pane_id: "w1:p1", focused: true, rect: { x: 0, y: 0, width: 60, height: 40 } }] }] } }];
    // the pinned layout has no panes in this fixture: a roster with one is a different set
    expect(pinLayouts(grown, pins, 2000)).toBe(grown);
    expect(pins.size).toBe(0);
  });

  it("leaves other machines alone", () => {
    const roster = [{ id: "local", snapshot: snapshotFixture() }];
    expect(pinLayouts(roster, pin(0.7), 2000)).toBe(roster);
  });
});
