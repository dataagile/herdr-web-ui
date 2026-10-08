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
