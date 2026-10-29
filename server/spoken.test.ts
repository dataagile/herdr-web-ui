import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { spokenLines } from "./spoken.ts";

describe("spokenLines", () => {
  test("reads the newest valid lines and skips broken ones", () => {
    const home = mkdtempSync(nodePath.join(tmpdir(), "spoken-"));
    mkdirSync(nodePath.join(home, "falacomigo"));
    const lines = Array.from({ length: 7 }, (_, i) => JSON.stringify({ at: i, lang: "pt-BR", text: `frase ${i}` }));
    writeFileSync(nodePath.join(home, "falacomigo", "s1.jsonl"), [...lines, "{broken", JSON.stringify({ at: 9 })].join("\n") + "\n");
    const read = spokenLines("s1", home);
    expect(read?.lines.map((line) => line.at)).toEqual([2, 3, 4, 5, 6]);
    expect(read?.lines[0]).toEqual({ at: 2, lang: "pt-BR", text: "frase 2" });
  });

  test("a session falacomigo never spoke in has none", () => {
    expect(spokenLines("missing", mkdtempSync(nodePath.join(tmpdir(), "spoken-")))).toBeNull();
  });
});
