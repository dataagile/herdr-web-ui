import { describe, expect, it } from "bun:test";

import { patchFiles, patchText } from "./patch.ts";
import { toolPatch } from "./tool-verbs.ts";

const PATCH = "*** Begin Patch\n*** Update File: src/a.ts\n@@\n-old\n+new\n*** Add File: docs/b.md\n+hi\n*** End Patch\n";

describe("Codex patches", () => {
  it("finds a patch given whole, or as the string an exec script hands to tools.apply_patch", () => {
    expect(patchText(PATCH)).toBe(PATCH);
    const script = `text(await tools.apply_patch(${JSON.stringify(PATCH)}));\nconsole.log("done")`;
    expect(patchText(script)).toBe(PATCH);
    expect(patchText("await tools.apply_patch(`" + PATCH + "`)")).toBe(PATCH);
    expect(patchText("tools.exec_command({cmd: 'ls'})")).toBeNull();
    expect(patchText('tools.apply_patch("not a patch")')).toBeNull();
  });

  it("names each file a patch touches once, in order", () => {
    expect(patchFiles(PATCH + "*** Update File: src/a.ts\n*** Delete File: old.txt\n")).toEqual(["src/a.ts", "docs/b.md", "old.txt"]);
  });
});

describe("the chat reads a patch only from the tools that carry one", () => {
  const heredoc = JSON.stringify({ command: ["apply_patch", PATCH] });
  it("agrees with the changed-files list: shell yes, a Bash or a JSON edit that quotes one no", () => {
    expect(toolPatch("shell", heredoc)).toBe(PATCH);
    expect(toolPatch("apply_patch", PATCH)).toBe(PATCH);
    expect(toolPatch("Bash", heredoc)).toBeNull();
    expect(toolPatch("Edit", JSON.stringify({ cmd: `apply_patch <<'EOF'\n${PATCH}\nEOF` }))).toBeNull();
  });
});
