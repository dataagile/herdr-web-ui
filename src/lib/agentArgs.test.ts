import { describe, expect, it } from "bun:test";

import { parseAgentArgs } from "./agentArgs.ts";

describe("parseAgentArgs", () => {
  it("splits on whitespace, collapsing runs", () => {
    expect(parseAgentArgs("--auto")).toEqual(["--auto"]);
    expect(parseAgentArgs("  --model   gpt-5  ")).toEqual(["--model", "gpt-5"]);
    expect(parseAgentArgs("")).toEqual([]);
    expect(parseAgentArgs("   ")).toEqual([]);
  });

  it("keeps a quoted group as one token", () => {
    expect(parseAgentArgs('--flag "two words"')).toEqual(["--flag", "two words"]);
    expect(parseAgentArgs("--flag 'two words'")).toEqual(["--flag", "two words"]);
    expect(parseAgentArgs('--flag "a \\"b\\""')).toEqual(["--flag", 'a "b"']);
  });

  it("honors a backslash outside quotes, and keeps an unterminated quote", () => {
    expect(parseAgentArgs("a\\ b")).toEqual(["a b"]);
    expect(parseAgentArgs('a "b')).toEqual(["a", "b"]);
  });

  it("keeps an empty quoted token, as a shell would", () => {
    expect(parseAgentArgs('--x ""')).toEqual(["--x", ""]);
  });
});
