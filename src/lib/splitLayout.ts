/**
 * A tab's panes laid out as herdr lays them. herdr reports a tab's layout as a flat list: the
 * panes with their rectangles, and the splits with a direction, a ratio and the rectangle they
 * divide (shared/herdr-api.generated.ts `PaneLayoutSnapshot`, in terminal cells). This turns
 * it back into a tree, positions that tree as fractions of the tab's area (CSS percentages), and
 * does the arithmetic of a divider drag: where the divider is while it is dragged, and which
 * pane.resize call moves herdr's border by that much.
 *
 * Pure: no DOM, no herdr. The component that draws it is SplitView.tsx.
 */
import type { PaneLayoutRect, PaneLayoutSnapshot } from "../../shared/protocol.ts";

/** The smallest a pane may be dragged to, in terminal cells. */
export const MIN_PANE_COLS = 10;
export const MIN_PANE_ROWS = 4;
/** herdr clamps one resize step to half a split (measured on 0.9.3); the server refuses more. */
export const MAX_RESIZE_STEP = 0.5;
/** a drag shorter than this fraction of its split moves nothing */
export const MIN_RESIZE_STEP = 0.005;
/** the viewport width from which a tab with several panes shows them side by side */
export const SPLIT_MIN_WIDTH = 1024;

export type SplitAxis = "right" | "down";

export type LayoutNode =
  | { kind: "pane"; paneId: string }
  | { kind: "split"; id: string; direction: SplitAxis; ratio: number; cells: PaneLayoutRect; first: LayoutNode; second: LayoutNode };

/** A box as fractions (0..1) of the tab's area. */
export interface Fraction { left: number; top: number; width: number; height: number }

export interface PanePlacement extends Fraction { paneId: string }

export interface DividerPlacement extends Fraction {
  splitId: string;
  direction: SplitAxis;
  ratio: number;
  /** the split's own box: a pointer inside it is where the divider would go */
  box: Fraction;
}

/** Cells a split is allowed at either end, as a ratio: a pane may not be dragged below its minimum. */
export function ratioLimits(direction: SplitAxis, cells: PaneLayoutRect): { min: number; max: number } {
  const extent = direction === "right" ? cells.width : cells.height;
  const least = direction === "right" ? MIN_PANE_COLS : MIN_PANE_ROWS;
  // a split too small for two minimum panes keeps the middle: there is nothing to drag
  const min = extent > 0 ? Math.min(0.5, least / extent) : 0.5;
  return { min, max: 1 - min };
}

/** `inner` lies within `outer`, give or take a cell of rounding. */
function within(inner: PaneLayoutRect, outer: PaneLayoutRect): boolean {
  return inner.x >= outer.x - 1 && inner.y >= outer.y - 1
    && inner.x + inner.width <= outer.x + outer.width + 1 && inner.y + inner.height <= outer.y + outer.height + 1;
}

/**
 * The layout as a tree, or null when herdr's report does not make one (a pane with no split to
 * divide it from the others): the caller then draws the panes at their rectangles, with no dividers.
 * A split divides the panes inside its rectangle; of the splits whose rectangle holds a set of
 * panes the smallest one is the one that divides exactly those.
 */
export function layoutTree(layout: Pick<PaneLayoutSnapshot, "panes" | "splits">): LayoutNode | null {
  const build = (panes: PaneLayoutSnapshot["panes"]): LayoutNode | null => {
    const only = panes[0];
    if (only === undefined) return null;
    if (panes.length === 1) return { kind: "pane", paneId: only.pane_id };
    let best: PaneLayoutSnapshot["splits"][number] | null = null;
    for (const split of layout.splits) {
      if (!panes.every((pane) => within(pane.rect, split.rect))) continue;
      if (best === null || split.rect.width * split.rect.height < best.rect.width * best.rect.height) best = split;
    }
    if (best === null) return null;
    // herdr's direction is open-ended ("right" | "down" | string): anything else is not a layout this draws
    if (best.direction !== "right" && best.direction !== "down") return null;
    const direction: SplitAxis = best.direction === "right" ? "right" : "down";
    const edge = direction === "right" ? best.rect.x + best.rect.width * best.ratio : best.rect.y + best.rect.height * best.ratio;
    const before = (pane: PaneLayoutSnapshot["panes"][number]): boolean =>
      (direction === "right" ? pane.rect.x + pane.rect.width / 2 : pane.rect.y + pane.rect.height / 2) < edge;
    const firstPanes = panes.filter(before);
    const secondPanes = panes.filter((pane) => !before(pane));
    if (firstPanes.length === 0 || secondPanes.length === 0) return null;
    const first = build(firstPanes);
    const second = build(secondPanes);
    return first && second ? { kind: "split", id: best.id, direction, ratio: best.ratio, cells: best.rect, first, second } : null;
  };
  return build(layout.panes);
}

/** Every pane of a tree, in reading order. */
export function treePanes(node: LayoutNode): string[] {
  return node.kind === "pane" ? [node.paneId] : [...treePanes(node.first), ...treePanes(node.second)];
}

/**
 * Where each pane and each divider sit, as fractions of the tab's area. `ratios` overrides a split's
 * ratio (a divider being dragged): its panes, and the panes inside them, follow.
 */
export function placements(node: LayoutNode, ratios: Readonly<Record<string, number>> = {}): { panes: PanePlacement[]; dividers: DividerPlacement[] } {
  const panes: PanePlacement[] = [];
  const dividers: DividerPlacement[] = [];
  const place = (current: LayoutNode, box: Fraction): void => {
    if (current.kind === "pane") { panes.push({ paneId: current.paneId, ...box }); return; }
    const limits = ratioLimits(current.direction, current.cells);
    const wanted = ratios[current.id] ?? current.ratio;
    const ratio = Math.min(limits.max, Math.max(limits.min, wanted));
    if (current.direction === "right") {
      const width = box.width * ratio;
      place(current.first, { ...box, width });
      place(current.second, { left: box.left + width, top: box.top, width: box.width - width, height: box.height });
      dividers.push({ splitId: current.id, direction: "right", ratio, left: box.left + width, top: box.top, width: 0, height: box.height, box });
    } else {
      const height = box.height * ratio;
      place(current.first, { ...box, height });
      place(current.second, { left: box.left, top: box.top + height, width: box.width, height: box.height - height });
      dividers.push({ splitId: current.id, direction: "down", ratio, left: box.left, top: box.top + height, width: box.width, height: 0, box });
    }
  };
  place(node, { left: 0, top: 0, width: 1, height: 1 });
  return { panes, dividers };
}

/** The panes at herdr's own rectangles, for a report that does not make a tree. */
export function flatPlacements(layout: Pick<PaneLayoutSnapshot, "area" | "panes">): PanePlacement[] {
  const { area } = layout;
  return layout.panes.map((pane) => ({
    paneId: pane.pane_id,
    left: (pane.rect.x - area.x) / area.width,
    top: (pane.rect.y - area.y) / area.height,
    width: pane.rect.width / area.width,
    height: pane.rect.height / area.height,
  }));
}

/** The split with this id, anywhere in the tree. */
export function findSplit(node: LayoutNode, id: string): Extract<LayoutNode, { kind: "split" }> | null {
  if (node.kind === "pane") return null;
  if (node.id === id) return node;
  return findSplit(node.first, id) ?? findSplit(node.second, id);
}

/**
 * Where a divider is when the pointer is at `pointer` (a fraction of the tab's area along the
 * split's axis, from the area's own origin): a ratio inside the split's own box, kept within
 * the limits so neither pane collapses.
 */
export function draggedRatio(split: DividerPlacement, cells: PaneLayoutRect, pointer: number): number {
  const origin = split.direction === "right" ? split.box.left : split.box.top;
  const extent = split.direction === "right" ? split.box.width : split.box.height;
  if (extent <= 0) return split.ratio;
  const { min, max } = ratioLimits(split.direction, cells);
  return Math.min(max, Math.max(min, (pointer - origin) / extent));
}

/** The leaf of `node` that touches its `side` edge on the axis: the pane whose border that edge is. */
function edgeLeaf(node: LayoutNode, axis: SplitAxis, side: "start" | "end"): string {
  if (node.kind === "pane") return node.paneId;
  if (node.direction !== axis) return edgeLeaf(node.first, axis, side);
  return edgeLeaf(side === "end" ? node.second : node.first, axis, side);
}

export interface ResizeStep {
  paneId: string;
  direction: "left" | "right" | "up" | "down";
  /** a fraction of the split, 0 < amount <= MAX_RESIZE_STEP */
  amount: number;
}

/**
 * The pane.resize call that moves a split's divider from `from` to `to` (ratios), or null for a
 * move too small to send. herdr's resize moves the border of the pane it is given on the side
 * named, that way (measured on 0.9.3, tab layouts of up to four panes): moving a divider toward
 * the end uses the pane touching it from the first side with "right"/"down", toward the start the
 * pane touching it from the second side with "left"/"up".
 */
export function resizeStep(split: Extract<LayoutNode, { kind: "split" }>, from: number, to: number): ResizeStep | null {
  const delta = to - from;
  if (!Number.isFinite(delta) || Math.abs(delta) < MIN_RESIZE_STEP) return null;
  const amount = Math.min(Math.abs(delta), MAX_RESIZE_STEP);
  const toward = delta > 0;
  const paneId = toward ? edgeLeaf(split.first, split.direction, "end") : edgeLeaf(split.second, split.direction, "start");
  const direction = split.direction === "right" ? (toward ? "right" : "left") : (toward ? "down" : "up");
  return { paneId, direction, amount };
}

/** The layout of a tab out of a snapshot's, or null. */
export function tabLayout(layouts: readonly PaneLayoutSnapshot[] | undefined, tabId: string | undefined): PaneLayoutSnapshot | null {
  if (!tabId) return null;
  return layouts?.find((layout) => layout.tab_id === tabId) ?? null;
}

/** What a tab shows: its panes side by side, or one pane (a phone, a narrow window, a zoomed pane, a tab of one). */
export function showsSplit(layout: Pick<PaneLayoutSnapshot, "panes" | "zoomed"> | null, wide: boolean): boolean {
  return wide && layout !== null && layout.panes.length > 1 && !layout.zoomed;
}

/**
 * The font size that makes a grid of `natural` pixels (measured at `size`) fill `room` pixels,
 * rounded down to a quarter pixel so a one-pixel wobble of the box does not set it off again.
 */
export function fittedFontSize(size: number, natural: { width: number; height: number }, room: { width: number; height: number }, limits = { min: 4, max: 32 }): number {
  if (!(natural.width > 0) || !(natural.height > 0) || !(room.width > 0) || !(room.height > 0)) return size;
  const scale = Math.min(room.width / natural.width, room.height / natural.height);
  const fitted = Math.floor(size * scale * 4) / 4;
  return Math.min(limits.max, Math.max(limits.min, fitted));
}
