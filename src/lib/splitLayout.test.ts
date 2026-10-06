import { describe, expect, it } from "bun:test";

import type { PaneLayoutSnapshot } from "../../shared/protocol.ts";
import { draggedRatio, findSplit, fittedFontSize, flatPlacements, layoutTree, MAX_RESIZE_STEP, MIN_PANE_COLS, placements, ratioLimits, resizeStep, showsSplit, tabLayout, type LayoutNode } from "./splitLayout.ts";

const treePanes = (node: LayoutNode): string[] => (node.kind === "pane" ? [node.paneId] : [...treePanes(node.first), ...treePanes(node.second)]);
const rect = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const pane = (pane_id: string, x: number, y: number, width: number, height: number, focused = false) => ({ pane_id, focused, rect: rect(x, y, width, height) });
const layout = (panes: PaneLayoutSnapshot["panes"], splits: PaneLayoutSnapshot["splits"], zoomed = false): PaneLayoutSnapshot => ({
  workspace_id: "w1", tab_id: "w1:t1", zoomed, area: rect(0, 0, 120, 40), focused_pane_id: panes[0]!.pane_id, panes, splits,
});

// what herdr 0.9.3 reported for a pane split right (ratio 0.6 after a resize)
const two = layout([pane("p1", 0, 0, 72, 40, true), pane("p2", 72, 0, 48, 40)], [{ id: "split_0_root", direction: "right", ratio: 0.6, rect: rect(0, 0, 120, 40) }]);

// the same tab with p2 split down (p3) and p1 split down (p4): as herdr reported it
const four = layout(
  [pane("p1", 0, 0, 48, 20, true), pane("p4", 0, 20, 48, 20), pane("p2", 48, 0, 72, 16), pane("p3", 48, 16, 72, 24)],
  [
    { id: "split_0_root", direction: "right", ratio: 0.4, rect: rect(0, 0, 120, 40) },
    { id: "split_1_0", direction: "down", ratio: 0.5, rect: rect(0, 0, 48, 40) },
    { id: "split_2_1", direction: "down", ratio: 0.4, rect: rect(48, 0, 72, 40) },
  ],
);

// three in a row: the second split is inside the first's right half
const row = layout(
  [pane("p1", 0, 0, 60, 40, true), pane("p2", 60, 0, 30, 40), pane("p3", 90, 0, 30, 40)],
  [
    { id: "split_0_root", direction: "right", ratio: 0.5, rect: rect(0, 0, 120, 40) },
    { id: "split_1_1", direction: "right", ratio: 0.5, rect: rect(60, 0, 60, 40) },
  ],
);

describe("layoutTree", () => {
  it("makes a tree of two panes, the first split's panes first", () => {
    const tree = layoutTree(two)!;
    expect(tree.kind).toBe("split");
    expect(treePanes(tree)).toEqual(["p1", "p2"]);
    expect(findSplit(tree, "split_0_root")).toMatchObject({ direction: "right", ratio: 0.6 });
  });

  it("nests a split inside the half it divides", () => {
    const tree = layoutTree(four)!;
    expect(treePanes(tree)).toEqual(["p1", "p4", "p2", "p3"]);
    expect(findSplit(tree, "split_1_0")).toMatchObject({ direction: "down" });
    expect(findSplit(tree, "split_2_1")).toMatchObject({ direction: "down", ratio: 0.4 });
    const row3 = layoutTree(row)!;
    expect(treePanes(row3)).toEqual(["p1", "p2", "p3"]);
    expect(findSplit(row3, "split_1_1")).toMatchObject({ direction: "right" });
  });

  it("is a lone pane for a tab of one, and null for a report that makes no tree", () => {
    expect(layoutTree(layout([pane("p1", 0, 0, 120, 40)], []))).toEqual({ kind: "pane", paneId: "p1" });
    expect(layoutTree(layout([pane("p1", 0, 0, 60, 40), pane("p2", 60, 0, 60, 40)], []))).toBeNull();
  });
});

describe("placements", () => {
  it("positions the panes as fractions of the area, with a divider on each split", () => {
    const { panes, dividers } = placements(layoutTree(two)!);
    expect(panes).toEqual([
      { paneId: "p1", left: 0, top: 0, width: 0.6, height: 1 },
      { paneId: "p2", left: 0.6, top: 0, width: 0.4, height: 1 },
    ]);
    expect(dividers).toHaveLength(1);
    expect(dividers[0]).toMatchObject({ splitId: "split_0_root", direction: "right", left: 0.6, top: 0, height: 1 });
  });

  it("follows herdr's rectangles for three panes", () => {
    const { panes } = placements(layoutTree(four)!);
    const byId = Object.fromEntries(panes.map((entry) => [entry.paneId, entry]));
    // herdr's rects: p2 is 72x16 at (48,0), p3 72x24 at (48,16), of a 120x40 area
    expect(byId["p2"]!.left).toBeCloseTo(48 / 120, 10);
    expect(byId["p2"]!.width).toBeCloseTo(72 / 120, 10);
    expect(byId["p2"]!.height).toBeCloseTo(16 / 40, 10);
    expect(byId["p3"]!.top).toBeCloseTo(16 / 40, 10);
    expect(byId["p1"]!.height).toBeCloseTo(20 / 40, 10);
  });

  it("moves the panes inside a half with the divider that is dragged, keeping the limits", () => {
    const tree = layoutTree(four)!;
    const moved = placements(tree, { split_0_root: 0.7 });
    const byId = Object.fromEntries(moved.panes.map((entry) => [entry.paneId, entry]));
    expect(byId["p1"]!.width).toBeCloseTo(0.7, 10);
    expect(byId["p2"]!.left).toBeCloseTo(0.7, 10);
    expect(byId["p2"]!.width).toBeCloseTo(0.3, 10);
    // the rows inside the right half keep their own ratio
    expect(byId["p2"]!.height).toBeCloseTo(0.4, 10);
    // far past the end: the pane keeps its minimum
    const squeezed = placements(tree, { split_0_root: 1 });
    expect(squeezed.dividers.find((divider) => divider.splitId === "split_0_root")!.ratio).toBeCloseTo(1 - MIN_PANE_COLS / 120, 10);
  });

  it("draws the panes at herdr's rectangles when there is no tree", () => {
    const flat = flatPlacements(layout([pane("p1", 0, 0, 60, 40), pane("p2", 60, 0, 60, 40)], []));
    expect(flat.map((entry) => [entry.paneId, entry.left, entry.width])).toEqual([["p1", 0, 0.5], ["p2", 0.5, 0.5]]);
  });
});

describe("a divider drag", () => {
  const divider = placements(layoutTree(two)!).dividers[0]!;

  it("puts the divider where the pointer is, inside the split's own box", () => {
    expect(draggedRatio(divider, two.splits[0]!.rect, 0.5)).toBeCloseTo(0.5, 10);
    // in the inner split of a column the pointer is measured from that split's own origin
    const inner = placements(layoutTree(four)!).dividers.find((entry) => entry.splitId === "split_2_1")!;
    expect(draggedRatio(inner, four.splits[2]!.rect, 0.5)).toBeCloseTo(0.5, 10);
  });

  it("never lets a pane collapse", () => {
    const limits = ratioLimits("right", two.splits[0]!.rect);
    expect(draggedRatio(divider, two.splits[0]!.rect, 0)).toBeCloseTo(limits.min, 10);
    expect(draggedRatio(divider, two.splits[0]!.rect, 5)).toBeCloseTo(limits.max, 10);
    expect(limits.min).toBeCloseTo(MIN_PANE_COLS / 120, 10);
    // a split with no room for two minimum panes keeps the middle
    expect(ratioLimits("down", rect(0, 0, 40, 6))).toEqual({ min: 0.5, max: 0.5 });
  });

  it("asks herdr to move the border the way it was moved, with the pane that touches it", () => {
    const tree = layoutTree(two)!;
    const root = findSplit(tree, "split_0_root")!;
    // toward the end: the pane before it, "right"; toward the start: the pane after it, "left"
    expect(resizeStep(root, 0.6, 0.7)).toEqual({ paneId: "p1", direction: "right", amount: expect.closeTo(0.1, 10) });
    expect(resizeStep(root, 0.6, 0.45)).toEqual({ paneId: "p2", direction: "left", amount: expect.closeTo(0.15, 10) });
  });

  it("picks the pane whose border the divider is when halves hold more splits", () => {
    const tree = layoutTree(four)!;
    // p1 and p4 both touch the root divider from the left; the right half's panes from the right
    expect(["p1", "p4"]).toContain(resizeStep(findSplit(tree, "split_0_root")!, 0.4, 0.5)!.paneId);
    expect(["p2", "p3"]).toContain(resizeStep(findSplit(tree, "split_0_root")!, 0.4, 0.3)!.paneId);
    expect(resizeStep(findSplit(tree, "split_2_1")!, 0.4, 0.5)).toMatchObject({ paneId: "p2", direction: "down" });
    expect(resizeStep(findSplit(tree, "split_2_1")!, 0.4, 0.3)).toMatchObject({ paneId: "p3", direction: "up" });
    // three in a row: the divider of the inner split is touched by p2 (before) and p3 (after);
    // the root's by p1, and from the other side by the inner split's first pane, not its last
    const row3 = layoutTree(row)!;
    expect(resizeStep(findSplit(row3, "split_1_1")!, 0.5, 0.6)).toMatchObject({ paneId: "p2", direction: "right" });
    expect(resizeStep(findSplit(row3, "split_0_root")!, 0.5, 0.4)).toMatchObject({ paneId: "p2", direction: "left" });
    expect(resizeStep(findSplit(row3, "split_0_root")!, 0.5, 0.6)).toMatchObject({ paneId: "p1", direction: "right" });
  });

  it("sends nothing for a nudge, and never more than half a split at once", () => {
    const root = findSplit(layoutTree(two)!, "split_0_root")!;
    expect(resizeStep(root, 0.6, 0.601)).toBeNull();
    expect(resizeStep(root, 0.6, Number.NaN)).toBeNull();
    expect(resizeStep(root, 0.1, 0.9)!.amount).toBe(MAX_RESIZE_STEP);
  });
});

describe("what a tab shows", () => {
  it("shows the panes side by side only when wide, split and not zoomed", () => {
    expect(showsSplit(two, true)).toBe(true);
    expect(showsSplit(two, false)).toBe(false);
    expect(showsSplit({ ...two, zoomed: true }, true)).toBe(false);
    expect(showsSplit(layout([pane("p1", 0, 0, 120, 40)], []), true)).toBe(false);
    expect(showsSplit(null, true)).toBe(false);
  });

  it("finds a tab's layout among a snapshot's", () => {
    expect(tabLayout([two], "w1:t1")).toBe(two);
    expect(tabLayout([two], "w1:t2")).toBeNull();
    expect(tabLayout(undefined, "w1:t1")).toBeNull();
    expect(tabLayout([two], undefined)).toBeNull();
  });
});

describe("fittedFontSize", () => {
  it("scales the font so the grid fills the box on its tighter side", () => {
    // a 600x300 grid at 14px into 300x300: width is the tight side, half the size
    expect(fittedFontSize(14, { width: 600, height: 300 }, { width: 300, height: 300 })).toBe(7);
    // into a box twice as tall and wide: height and width both allow double
    expect(fittedFontSize(14, { width: 600, height: 300 }, { width: 1200, height: 600 })).toBe(28);
  });

  it("rounds down to a quarter pixel, and stays inside the limits", () => {
    expect(fittedFontSize(14, { width: 100, height: 100 }, { width: 111, height: 111 })).toBe(15.5);
    expect(fittedFontSize(14, { width: 100, height: 100 }, { width: 5, height: 5 })).toBe(4);
    expect(fittedFontSize(14, { width: 100, height: 100 }, { width: 900, height: 900 })).toBe(32);
  });

  it("keeps the size when there is nothing to measure", () => {
    expect(fittedFontSize(14, { width: 0, height: 100 }, { width: 300, height: 300 })).toBe(14);
    expect(fittedFontSize(14, { width: 100, height: 100 }, { width: 0, height: 300 })).toBe(14);
  });
});
