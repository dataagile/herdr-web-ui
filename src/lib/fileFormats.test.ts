import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HtmlFrame } from "../components/HtmlFrame.tsx";
import { formatOf } from "./fileFormats.ts";

describe("formatOf", () => {
  it("knows markdown and html by extension only", () => {
    expect([formatOf("a.md"), formatOf("A.MARKDOWN"), formatOf("x.html"), formatOf("x.HTM"), formatOf("a.pdf"), formatOf("md"), formatOf("a.md.txt")]).toEqual(["md", "md", "html", "html", null, null, null]);
  });
});

describe("HtmlFrame", () => {
  const html = renderToStaticMarkup(createElement(HtmlFrame, { html: '<script>alert(1)</script><p onclick="x()">hi</p>', title: "r.html" }));
  it("is sandboxed with no permission at all", () => {
    expect(html).toContain('sandbox=""');
    expect(html).not.toMatch(/allow-/);
  });
  it("carries the file as the document and never as markup of the app", () => {
    expect(html).toContain("srcDoc=");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script");
  });
});
