import type { Machine } from "../../shared/machines.ts";
import type { PaneInfo, WorkspaceInfo } from "../../shared/protocol.ts";

export type PaneNeedingYou = { pane: PaneInfo; workspace: WorkspaceInfo };

/**
 * The panes of one PC that wait for the user: blocked (an answer is due) first, then done (a turn
 * ended and nobody has seen it), each in workspace order. Offline rosters are cached: only a
 * connected PC can tell us an agent still needs us. On a PC whose bridge refuses `pane/seen` (an old
 * bridge, or a watch-role device) this device could never clear a DONE row: only blocked is listed.
 */
export function panesNeedingYou(machine: Machine, seenRefused = false): PaneNeedingYou[] {
  if (machine.state !== "connected" || !machine.snapshot) return [];
  const { panes, workspaces } = machine.snapshot;
  const blocked: PaneNeedingYou[] = [];
  const done: PaneNeedingYou[] = [];
  for (const workspace of workspaces) for (const pane of panes) {
    if (pane.workspace_id !== workspace.workspace_id) continue;
    if (pane.agent_status === "blocked") blocked.push({ pane, workspace });
    else if (pane.agent_status === "done" && !seenRefused) done.push({ pane, workspace });
  }
  return [...blocked, ...done];
}
