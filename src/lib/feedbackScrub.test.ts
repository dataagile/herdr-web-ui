import { describe, expect, it } from "bun:test";

import vectors from "./feedbackScrub.vectors.json";
import { isSensitiveKey, scrubChatText, scrubText, scrubUrl } from "./feedbackScrub.ts";

interface Case {
  id: string;
  kind: "text" | "url" | "chat_text" | "key";
  input: string;
  expected: string | boolean;
}
const cases = vectors.cases as Case[];

function run(c: Case): string | boolean {
  switch (c.kind) {
    case "text": return scrubText(c.input);
    case "url": return scrubUrl(c.input);
    case "chat_text": return scrubChatText(c.input);
    case "key": return isSensitiveKey(c.input);
  }
}

describe("scrub by value: the vectors shared with AgentOS", () => {
  it("has all 99 cases", () => expect(cases).toHaveLength(99));
  it.each(cases.map((c) => [c.id, c] as const))("%s", (_id, c) => {
    expect(run(c)).toBe(c.expected);
  });
});

describe("scrub properties", () => {
  it("is idempotent on the text and url cases", () => {
    for (const c of cases.filter((x) => x.kind === "text" || x.kind === "url")) {
      const once = run(c) as string;
      expect(c.kind === "text" ? scrubText(once) : scrubUrl(once), c.id).toBe(once);
    }
  });

  it("drops the origin and the fragment of an absolute url", () => {
    expect(scrubUrl("https://app.example.com/api/v1/me?x=1#frag")).toBe("/api/v1/me?x=[Q]");
  });

  it.each([
    ["letters", "a".repeat(100_000)],
    ["repeated token", "token".repeat(20_000)],
    ["repeated eyJ", "eyJ".repeat(33_000)],
    ["digit and space", "1 ".repeat(50_000)],
    ["dot", "a.".repeat(50_000)],
    ["digits", "1".repeat(100_000)],
    ["repeated at", "a@".repeat(50_000)],
    ["repeated bearer", "bearer ".repeat(14_000)],
    ["email without end", "a".repeat(50_000) + "@" + "b".repeat(50_000)],
    ["open quotes", 'token="'.repeat(14_000)],
    ["eyJ with dots", "eyJ.".repeat(25_000)],
  ])("a 100 KB input (%s) finishes fast", (_name, input) => {
    const start = performance.now();
    scrubText(input);
    scrubUrl("/" + input);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
