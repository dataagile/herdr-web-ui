import { expect, it } from "bun:test";

import type { PaneInfo } from "../../shared/protocol.ts";
import { agentPanes } from "./agentPanes.ts";

const pane = (pane_id: string, workspace_id: string, extra: Partial<PaneInfo> = {}) => ({ pane_id, workspace_id, ...extra }) as PaneInfo;

it("lists agent panes only, by workspace order then pane order", () => {
  const panes = [
    pane("p1", "w2", { agent: "claude" }),
    pane("p2", "w1"),
    pane("p3", "w1", { display_agent: "pi" }),
    pane("p4", "w2", { agent: null, display_agent: null }),
    pane("p5", "w1", { agent: "codex" }),
  ];
  expect(agentPanes(panes, ["w1", "w2"]).map((p) => p.pane_id)).toEqual(["p3", "p5", "p1"]);
  expect(agentPanes(panes, ["w2", "w1"]).map((p) => p.pane_id)).toEqual(["p1", "p3", "p5"]);
});
