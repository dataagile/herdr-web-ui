import type { Machine } from "../../shared/machines.ts";
import type { PaneInfo, WorkspaceInfo } from "../../shared/protocol.ts";

export type PaneNeedingYou = { pane: PaneInfo; workspace: WorkspaceInfo };

/**
 * The panes of one PC that wait for the user: blocked (an answer is due) first, then done (a turn
 * ended and nobody has seen it), each in workspace order. Offline rosters are cached: only a
 * connected PC can tell us an agent still needs us.
 */
export function panesNeedingYou(machine: Machine): PaneNeedingYou[] {
  if (machine.state !== "connected" || !machine.snapshot) return [];
  const { panes, workspaces } = machine.snapshot;
  const rows = (status: string) => workspaces.flatMap((workspace) => panes
    .filter((pane) => pane.workspace_id === workspace.workspace_id && pane.agent_status === status)
    .map((pane) => ({ pane, workspace })));
  return [...rows("blocked"), ...rows("done")];
}
