import { describe, expect, it } from "bun:test";

import { builtLabel, currentBuild, versionLine } from "./buildInfo.ts";

describe("versionLine", () => {
  it("is the brand, the version and the commit, in that order", () => {
    expect(versionLine({ version: "0.3.52", commit: "fc94649", built: null })).toBe("Data Agile Dev · v0.3.52 · fc94649");
  });

  it("reads the dev commit a build without Git carries", () => {
    expect(versionLine({ version: "0.3.52", commit: "dev", built: null }).split(" · ")).toEqual(["Data Agile Dev", "v0.3.52", "dev"]);
  });
});

describe("currentBuild", () => {
  it("falls back to dev where the bundle defines nothing (a script's own build, a test)", () => {
    expect(currentBuild()).toEqual({ version: "dev", commit: "dev", built: null });
  });
});

describe("builtLabel", () => {
  it("formats an ISO time for the reader, and says nothing for none or a bad one", () => {
    expect(builtLabel("2026-10-06T17:20:00Z", "en-US")).toMatch(/2026|26/);
    expect(builtLabel(null)).toBeNull();
    expect(builtLabel("not a date")).toBeNull();
  });
});
