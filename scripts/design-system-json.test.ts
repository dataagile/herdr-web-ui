import { expect, it } from "bun:test";
import { readFileSync } from "node:fs";

// design-system/*.json are hand-edited exports; a stray quote once made one unparseable.
it("every JSON file in design-system/ parses", async () => {
  const files = [...new Bun.Glob("design-system/**/*.json").scanSync({ cwd: process.cwd() })];
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) expect(() => JSON.parse(readFileSync(file, "utf8")), file).not.toThrow();
});
