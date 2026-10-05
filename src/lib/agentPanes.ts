import type { PaneInfo } from "../../shared/protocol.ts";

/** herdr's Agents panel lists a pane once an agent is named or detected in it; a plain shell is not one. */
export const isAgentPane = (pane: PaneInfo): boolean => Boolean(pane.agent || pane.display_agent);

/** The agent panes, workspaces in `workspaceOrder`, each workspace's panes in the order given. */
export function agentPanes<T extends PaneInfo>(panes: readonly T[], workspaceOrder: readonly string[]): T[] {
  return workspaceOrder.flatMap((id) => panes.filter((pane) => pane.workspace_id === id && isAgentPane(pane)));
}
