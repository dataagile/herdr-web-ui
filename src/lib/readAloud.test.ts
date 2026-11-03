import { expect, test } from "bun:test";
import { newSpokenLines } from "./readAloud.ts";

test("a pane's first read is taken as heard; later reads hand over only newer lines", () => {
  expect(newSpokenLines("p1", [{ at: 1, text: "old" }])).toBeNull();
  expect(newSpokenLines("p1", [{ at: 1, text: "old" }])).toEqual([]);
  expect(newSpokenLines("p1", [{ at: 1, text: "old" }, { at: 2, text: "new" }, { at: 3, text: "newer" }])?.map((line) => line.text)).toEqual(["new", "newer"]);
  expect(newSpokenLines("p2", undefined)).toBeNull();
  expect(newSpokenLines("p2", [{ at: 5, text: "first" }])).toEqual([{ at: 5, text: "first" }]);
});
