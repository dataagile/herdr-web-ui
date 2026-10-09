import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HtmlFrame } from "../components/HtmlFrame.tsx";
import { formatOf, frameDocument, HTML_FRAME_CSP } from "./fileFormats.ts";

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

describe("frameDocument", () => {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${HTML_FRAME_CSP}">`;
  it("puts the policy first, after the doctype, whatever the file has", () => {
    expect(frameDocument("<!DOCTYPE html><html><head><title>t</title></head><body></body></html>")).toBe(`<!DOCTYPE html>${meta}<html><head><title>t</title></head><body></body></html>`);
    expect(frameDocument("<p>hi</p>")).toBe(`${meta}<p>hi</p>`);
    expect(frameDocument("  <!-- c --><!doctype html>\n<p>x</p>")).toBe(`  <!-- c --><!doctype html>${meta}\n<p>x</p>`);
  });
  it("is not fooled by a head tag in a comment", () => {
    expect(frameDocument("<!doctype html><!-- <head> --><img src=https://example.com/x.png>").startsWith(`<!doctype html>${meta}`)).toBe(true);
  });
  it("blocks every fetch but inline style and data: images and fonts", () => {
    expect(HTML_FRAME_CSP).toBe("default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:");
    expect(renderToStaticMarkup(createElement(HtmlFrame, { html: "<p>a</p>", title: "t" }))).toContain("Content-Security-Policy");
  });
});
