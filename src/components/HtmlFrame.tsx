/**
 * An .html file drawn from its text. `sandbox=""` is every restriction at once: no scripts, no
 * forms, no popups, no same-origin access to the app, so the page cannot read the session or
 * navigate the app away. Relative images and links of the file may not load.
 */
export function HtmlFrame({ html, title }: { html: string; title: string }) {
  return <iframe className="file-viewer-html" sandbox="" srcDoc={html} title={title} />;
}
