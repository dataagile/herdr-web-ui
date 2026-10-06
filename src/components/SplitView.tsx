import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Columns2, Maximize2, X } from "lucide-react";

import "./SplitView.css";

import type { PaneInfo, PaneLayoutSnapshot } from "../../shared/protocol.ts";
import { useT } from "../lib/i18n.ts";
import { agentDisplayLabel } from "../lib/compose.ts";
import { draggedRatio, findSplit, flatPlacements, layoutTree, placements, resizeStep, type DividerPlacement, type PanePlacement, type ResizeStep } from "../lib/splitLayout.ts";
import { AgentMark } from "./AgentMark.tsx";
import { displayPaneTitle } from "./Sidebar.tsx";

/** how long a drag rests before the resize goes to herdr: the preview follows the pointer, herdr follows the pause */
const RESIZE_SEND_MS = 150;
/** what an arrow key on a focused divider moves it by, as a fraction of its split */
const KEY_STEP = 0.05;

export interface SplitViewProps {
  layout: PaneLayoutSnapshot;
  panes: PaneInfo[];
  /** the pane that holds the keyboard */
  selectedPaneId: string | null;
  onFocus: (paneId: string) => void;
  onSplit: (paneId: string, anchor: HTMLElement) => void;
  onZoom: (paneId: string) => void;
  onClose: (paneId: string) => void;
  /** sends one pane.resize; settles once herdr has answered and the layout is in place */
  onResize: (step: ResizeStep) => Promise<void>;
  /** one pane's live terminal: `grid` is its cells in herdr's layout */
  renderTerminal: (pane: PaneInfo, active: boolean, grid: { cols: number; rows: number }) => ReactNode;
}

const percent = (fraction: number): string => `${fraction * 100}%`;

/**
 * A tab's panes side by side, laid out as herdr lays them (lib/splitLayout.ts): each with a thin
 * header (agent · name, split, zoom, close) over its own live terminal, the focused one edged in
 * the accent. Dragging the divider between two panes previews at once and asks herdr for the
 * resize once the pointer rests (`pane.resize`); herdr's answer is the layout that stays.
 */
export function SplitView({ layout, panes, selectedPaneId, onFocus, onSplit, onZoom, onClose, onResize, renderTerminal }: SplitViewProps) {
  const t = useT();
  const area = useRef<HTMLDivElement>(null);
  const tree = useMemo(() => layoutTree(layout), [layout]);
  // the ratios of the dividers being dragged, over herdr's own until its answer lands
  const [dragged, setDragged] = useState<Record<string, number>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const sending = useRef<Promise<void>>(Promise.resolve());
  const placed = useMemo(() => {
    if (tree === null) return { panes: flatPlacements(layout), dividers: [] as DividerPlacement[] };
    return placements(tree, dragged);
  }, [tree, layout, dragged]);
  const paneById = useMemo(() => new Map(panes.map((pane) => [pane.pane_id, pane])), [panes]);
  const cellsOf = useMemo(() => new Map(layout.panes.map((entry) => [entry.pane_id, { cols: entry.rect.width, rows: entry.rect.height }])), [layout]);

  // one resize at a time, in order: two in flight could land the second first
  const send = useCallback((step: ResizeStep): Promise<void> => {
    sending.current = sending.current.then(() => onResize(step)).catch(() => undefined);
    return sending.current;
  }, [onResize]);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>, divider: DividerPlacement): void => {
    const box = area.current?.getBoundingClientRect();
    const split = tree === null ? null : findSplit(tree, divider.splitId);
    if (!box || box.width === 0 || box.height === 0 || split === null || event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    setDragging(divider.splitId);
    // the ratio herdr has, and the one the pointer wants: each send moves herdr by the difference
    let known = split.ratio;
    let wanted = split.ratio;
    let timer: number | null = null;
    const flush = (): void => {
      timer = null;
      const step = resizeStep(split, known, wanted);
      if (step === null) return;
      known = wanted;
      void send(step);
    };
    const move = (move: PointerEvent): void => {
      const pointer = divider.direction === "right" ? (move.clientX - box.left) / box.width : (move.clientY - box.top) / box.height;
      wanted = draggedRatio(divider, split.cells, pointer);
      setDragged((current) => ({ ...current, [divider.splitId]: wanted }));
      if (timer === null) timer = window.setTimeout(flush, RESIZE_SEND_MS);
    };
    const end = (): void => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      if (timer !== null) window.clearTimeout(timer);
      flush();
      // herdr's layout replaces the preview once the last resize has been answered
      void sending.current.then(() => {
        setDragged((current) => { const { [divider.splitId]: _gone, ...rest } = current; return rest; });
        setDragging((current) => current === divider.splitId ? null : current);
      });
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  const nudge = (event: ReactKeyboardEvent<HTMLDivElement>, divider: DividerPlacement): void => {
    const horizontal = divider.direction === "right";
    const delta = event.key === (horizontal ? "ArrowRight" : "ArrowDown") ? KEY_STEP : event.key === (horizontal ? "ArrowLeft" : "ArrowUp") ? -KEY_STEP : 0;
    const split = tree === null ? null : findSplit(tree, divider.splitId);
    if (delta === 0 || split === null) return;
    event.preventDefault();
    const step = resizeStep(split, split.ratio, split.ratio + delta);
    if (step !== null) void send(step);
  };

  // a divider gone from the layout (the pane next to it closed) takes its preview with it
  useEffect(() => {
    if (tree === null || Object.keys(dragged).every((id) => findSplit(tree, id) !== null)) return;
    setDragged((current) => Object.fromEntries(Object.entries(current).filter(([id]) => findSplit(tree, id) !== null)));
  }, [tree, dragged]);

  return (
    <div className="split-view" data-dragging={dragging !== null ? "" : undefined}>
      <div className="split-area" ref={area}>
        {placed.panes.map((place: PanePlacement) => {
          const pane = paneById.get(place.paneId);
          if (!pane) return null;
          const active = place.paneId === selectedPaneId;
          const title = displayPaneTitle(pane);
          const agent = pane.agent ?? null;
          return (
            <div key={place.paneId} className="split-cell" style={{ left: percent(place.left), top: percent(place.top), width: percent(place.width), height: percent(place.height) }}>
              <section
                className={`split-pane${active ? " is-focused" : ""}`}
                data-split-pane={place.paneId}
                aria-label={title}
                onPointerDownCapture={() => { if (!active) onFocus(place.paneId); }}
              >
                <header className="split-pane-head">
                  {agent && <AgentMark agent={agent} size={14} />}
                  <span className="split-pane-title"><b>{agentDisplayLabel(agent)}</b> · {title}</span>
                  <button type="button" className="split-pane-button" aria-label={t("Split")} aria-haspopup="menu" title={t("Split")} onClick={(event) => onSplit(place.paneId, event.currentTarget)}><Columns2 aria-hidden="true" /></button>
                  <button type="button" className="split-pane-button" aria-label={t("Zoom")} title={t("Zoom")} onClick={() => onZoom(place.paneId)}><Maximize2 aria-hidden="true" /></button>
                  <button type="button" className="split-pane-button" aria-label={t("Close pane")} title={t("Close pane")} onClick={() => onClose(place.paneId)}><X aria-hidden="true" /></button>
                </header>
                <div className="split-pane-body">{renderTerminal(pane, active, cellsOf.get(place.paneId) ?? { cols: 80, rows: 24 })}</div>
              </section>
            </div>
          );
        })}
        {placed.dividers.map((divider) => (
          <div
            key={divider.splitId}
            className={`split-divider is-${divider.direction === "right" ? "vertical" : "horizontal"}${dragging === divider.splitId ? " is-dragging" : ""}`}
            style={{ left: percent(divider.left), top: percent(divider.top), ...(divider.direction === "right" ? { height: percent(divider.height) } : { width: percent(divider.width) }) }}
            role="separator"
            aria-orientation={divider.direction === "right" ? "vertical" : "horizontal"}
            aria-label={t("Resize panes")}
            aria-valuenow={Math.round(divider.ratio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            tabIndex={0}
            onPointerDown={(event) => startDrag(event, divider)}
            onKeyDown={(event) => nudge(event, divider)}
          />
        ))}
      </div>
    </div>
  );
}
