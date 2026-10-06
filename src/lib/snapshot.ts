import type { AgentStatus, HerdrPane, PaneLayoutSnapshot, SessionSnapshot } from "../../shared/protocol.ts";

/**
 * Merges a pushed `pane-status` into the last snapshot so the sidebar badge updates
 * instantly; the debounced /api/session refetch that follows brings the derived
 * workspace/tab rollups back in line. Pure: returns the same object when nothing changed.
 */
export function applyPaneStatus(snapshot: SessionSnapshot, paneId: string, status: AgentStatus, background?: number): SessionSnapshot {
  let paneChanged = false;
  const panes = snapshot.panes.map((pane: HerdrPane) => {
    // a frame that says nothing of background tasks leaves the count as it was
    const tasks = background === undefined ? pane.background_tasks : background > 0 ? background : undefined;
    if (pane.pane_id !== paneId || (pane.agent_status === status && pane.background_tasks === tasks)) return pane;
    paneChanged = true;
    const { background_tasks: _before, ...rest } = pane;
    return { ...rest, agent_status: status, ...(tasks === undefined ? {} : { background_tasks: tasks }) };
  });
  if (!paneChanged) return snapshot;
  const agents = snapshot.agents.map((agent) =>
    agent.pane_id === paneId && agent.agent_status !== status ? { ...agent, agent_status: status } : agent,
  );
  return { ...snapshot, panes, agents };
}

/**
 * Puts the layout herdr answered a resize or a zoom with into the snapshot, in place of the tab's
 * own: the panes move at once, the refetch that follows confirms. Pure.
 */
export function applyLayout(snapshot: SessionSnapshot, layout: PaneLayoutSnapshot): SessionSnapshot {
  const layouts = snapshot.layouts ?? [];
  const known = layouts.some((entry) => entry.tab_id === layout.tab_id);
  return { ...snapshot, layouts: known ? layouts.map((entry) => (entry.tab_id === layout.tab_id ? layout : entry)) : [...layouts, layout] };
}
