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

/** A layout herdr answered a resize or a zoom with, held over any older roster that arrives after it. */
export interface LayoutPin { machineId: string; layout: PaneLayoutSnapshot; at: number }

/** how long an answered layout outranks the rosters read around it: a PC's own refresh is every 5 s */
export const LAYOUT_PIN_MS = 8000;

/**
 * Puts the pinned layouts back over a roster that was read before they were answered (a remote
 * PC's roster, or any poll in flight): a pin goes once the roster carries the same layout, a different set of panes, or when it
 * is older than LAYOUT_PIN_MS. Returns the same array when nothing changed.
 */
export function pinLayouts<M extends { id: string; snapshot?: SessionSnapshot | null }>(machines: M[], pins: Map<string, LayoutPin>, now: number): M[] {
  let changed = false;
  const next = machines.map((machine) => {
    let snapshot = machine.snapshot;
    for (const [key, pin] of pins) {
      if (pin.machineId !== machine.id) continue;
      if (now - pin.at > LAYOUT_PIN_MS) { pins.delete(key); continue; }
      if (!snapshot) continue;
      const have = snapshot.layouts?.find((layout) => layout.tab_id === pin.layout.tab_id);
      if (have && JSON.stringify(have) === JSON.stringify(pin.layout)) { pins.delete(key); continue; }
      // a pane made or closed since (here or elsewhere) is a newer layout than the answered one
      if (have && have.panes.map((pane) => pane.pane_id).sort().join() !== pin.layout.panes.map((pane) => pane.pane_id).sort().join()) { pins.delete(key); continue; }
      snapshot = applyLayout(snapshot, pin.layout);
    }
    if (snapshot === machine.snapshot) return machine;
    changed = true;
    return { ...machine, snapshot };
  });
  return changed ? next : machines;
}
