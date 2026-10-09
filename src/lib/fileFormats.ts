/** Text formats the file viewer can draw, not only show. */

export type FileFormat = "md" | "html";
export type ViewMode = "view" | "code";

export function formatOf(name: string): FileFormat | null {
  if (/\.(?:md|markdown)$/i.test(name)) return "md";
  if (/\.html?$/i.test(name)) return "html";
  return null;
}

const key = (format: FileFormat): string => `herdr-web-ui:file-view:${format}`;

/** The choice between the drawn file and its code, kept per format; drawn is the default. */
export function readViewMode(format: FileFormat): ViewMode {
  try { return localStorage.getItem(key(format)) === "code" ? "code" : "view"; } catch { return "view"; }
}

export function writeViewMode(format: FileFormat, mode: ViewMode): void {
  try { localStorage.setItem(key(format), mode); } catch {}
}

/**
 * The document the frame shows: the file's own html with a content security policy first in
 * `<head>` (created when the file has none; a doctype stays first so the page is not in quirks
 * mode). Nothing is fetched, so a remote image or stylesheet cannot report that the file was
 * opened; inline styles and `data:` images and fonts still draw.
 */
export const HTML_FRAME_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:";
const META = `<meta http-equiv="Content-Security-Policy" content="${HTML_FRAME_CSP}">`;

export function frameDocument(html: string): string {
  // right after the doctype (and any comments before it), so the parser makes the <head> around it and
  // the policy is the first thing in it; searching the text for a `<head>` could land in a comment
  const lead = /^(?:\s|<!--[\s\S]*?-->)*<!doctype[^>]*>/i.exec(html)?.[0] ?? "";
  return `${lead}${META}${html.slice(lead.length)}`;
}
