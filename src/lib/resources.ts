import { useEffect, useMemo, useState } from "react";

import type { MachineResources, ResourceMeter, SessionSnapshot } from "../../shared/protocol.ts";
import { fetchMachineResources } from "./api.ts";
import { usePageVisible } from "./visibility.ts";

/** How often a PC's line is read again while the page is on screen. */
export const RESOURCES_POLL_MS = 5_000;
/** from this much used, a PC meter shows in the blocked color */
export const HIGH_PERCENT = 90;
/** a project is heavy from this share of the whole PC's CPU… */
export const HEAVY_CPU = 50;
/** …or this share of its memory */
export const HEAVY_MEMORY_SHARE = 0.25;

export function meterPercent(meter: ResourceMeter | null): number | null {
  return meter && meter.total > 0 ? Math.round((meter.used / meter.total) * 100) : null;
}

/** "640 MB", "1.8 GB": one decimal from a gigabyte on, in the reader's own number format. */
export function formatSize(bytes: number, locale?: string): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${Math.round(mb).toLocaleString(locale)} MB`;
  return `${(mb / 1024).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
}

/** What one project's panes use together; `paneId` is its heaviest pane, whose mark the list draws. */
export interface ProjectLoad { workspaceId: string; label: string; paneId: string; agent: string | null; cpu: number | null; memory: number }

/** The PC's projects by what they use, heaviest CPU first, then memory. A project none of whose panes were measured is left out. */
export function projectLoads(snapshot: SessionSnapshot | null, resources: MachineResources | null): ProjectLoad[] {
  if (!snapshot || !resources) return [];
  const measured = new Map(resources.panes.map((pane) => [pane.pane_id, pane]));
  const loads = new Map<string, ProjectLoad & { heaviest: number }>();
  for (const pane of snapshot.panes) {
    const reading = measured.get(pane.pane_id);
    const workspace = snapshot.workspaces.find((candidate) => candidate.workspace_id === pane.workspace_id);
    if (!reading || !workspace) continue;
    const load = loads.get(workspace.workspace_id) ?? { workspaceId: workspace.workspace_id, label: workspace.label, paneId: pane.pane_id, agent: pane.agent ?? null, cpu: null, memory: 0, heaviest: -1 };
    load.memory += reading.memory;
    if (reading.cpu !== null) load.cpu = (load.cpu ?? 0) + reading.cpu;
    const weight = reading.cpu ?? 0;
    if (weight > load.heaviest) Object.assign(load, { heaviest: weight, paneId: pane.pane_id, agent: pane.agent ?? null });
    loads.set(workspace.workspace_id, load);
  }
  return [...loads.values()]
    .map(({ heaviest: _, ...load }) => ({ ...load, cpu: load.cpu === null ? null : Math.min(100, load.cpu) }))
    .sort((a, b) => (b.cpu ?? 0) - (a.cpu ?? 0) || b.memory - a.memory);
}

export function isHeavy(load: ProjectLoad, memoryTotal: number | undefined): boolean {
  return (load.cpu ?? 0) >= HEAVY_CPU || (memoryTotal !== undefined && memoryTotal > 0 && load.memory / memoryTotal >= HEAVY_MEMORY_SHARE);
}

/** Memory in use outside every measured pane (the browser, the system…); shared pages counted twice can push the sum past it, so never below 0. */
export function outsideProjects(resources: MachineResources): number | null {
  if (!resources.memory) return null;
  return Math.max(0, resources.memory.used - resources.panes.reduce((sum, pane) => sum + pane.memory, 0));
}

export interface ResourcesState {
  resources: MachineResources | null;
  /** false once the PC's bridge answered that it does not know the route: the line is not drawn */
  supported: boolean;
}

/**
 * A PC's resources, with its panes' share, every RESOURCES_POLL_MS while the page is on screen and
 * the PC is connected. A remote PC answers through its own bridge.
 */
export function useMachineResources(machineId: string, online: boolean, snapshot: SessionSnapshot | null): ResourcesState {
  const [state, setState] = useState<ResourcesState & { machineId: string }>({ machineId, resources: null, supported: true });
  const visible = usePageVisible();
  // a PC that reconnects may be running a newer bridge: ask it again
  // ponytail: a passing 401 (a rotated token) or a reconnect this client never saw as offline leaves the line off until a reload; retry with a backoff if that bites
  useEffect(() => { if (!online) setState((current) => (current.supported ? current : { ...current, supported: true })); }, [online]);
  const panes = useMemo(() => (snapshot?.panes ?? []).map((pane) => pane.pane_id).sort().join(","), [snapshot]);

  useEffect(() => {
    if (!online || !visible || !state.supported) return;
    let cancelled = false;
    const load = (): void => {
      fetchMachineResources(machineId, panes ? panes.split(",") : []).then((resources) => {
        if (!cancelled) setState({ machineId, resources, supported: resources !== null });
      }).catch(() => { /* keep the last numbers: the next poll tries again */ });
    };
    load();
    const timer = window.setInterval(load, RESOURCES_POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [machineId, online, visible, panes, state.supported]);

  return state.machineId === machineId ? { resources: online ? state.resources : null, supported: state.supported } : { resources: null, supported: true };
}
