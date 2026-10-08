/**
 * The picker's print: what is on the screen, as a PNG (a JPEG at quality 0.85 when the PNG is over
 * 1.5 MB). `html-to-image` draws the `<body>` shifted by the scroll and cut to the window; the
 * picker's own layer is left out by `filter`, and the highlight is drawn afterwards straight onto
 * the canvas in the accent colour: a `position: fixed` highlight inside the shifted clone would
 * land displaced by the scroll. A dragged area crops the canvas instead of outlining it.
 */
import { toCanvas } from "html-to-image";

/** marks everything the picker draws, so the print never contains it */
export const PICKER_ATTR = "data-feedback-picker";

const MAX_PIXEL_RATIO = 1.5;
const LINE_WIDTH = 3;
const HALO_EXTRA_WIDTH = 4;
const JPEG_FALLBACK_BYTES = 1.5 * 1024 * 1024;

/** A canvas does not read `var()`: ask the page for the colour a token resolves to. */
export function tokenColor(token: string, property: "color" | "backgroundColor" = "color"): string {
  const probe = document.createElement("span");
  probe.style[property] = `var(${token})`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe)[property];
  probe.remove();
  return resolved;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function drawHighlight(canvas: HTMLCanvasElement, rect: DOMRect, ratio: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const [x, y, w, h] = [rect.left * ratio, rect.top * ratio, rect.width * ratio, rect.height * ratio];
  // a dark halo under the accent line keeps it visible on any background
  ctx.strokeStyle = tokenColor("--scrim", "backgroundColor");
  ctx.lineWidth = (LINE_WIDTH + HALO_EXTRA_WIDTH) * ratio;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = tokenColor("--accent");
  ctx.lineWidth = LINE_WIDTH * ratio;
  ctx.strokeRect(x, y, w, h);
}

function crop(source: HTMLCanvasElement, rect: DOMRect, ratio: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(rect.width * ratio));
  out.height = Math.max(1, Math.round(rect.height * ratio));
  out.getContext("2d")?.drawImage(source, rect.left * ratio, rect.top * ratio, rect.width * ratio, rect.height * ratio, 0, 0, out.width, out.height);
  return out;
}

export async function captureScreen(rect: DOMRect, options: { crop?: boolean } = {}): Promise<File> {
  const { scrollX, scrollY, innerWidth, innerHeight } = window;
  const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  let canvas = await toCanvas(document.body, {
    width: innerWidth,
    height: innerHeight,
    pixelRatio: ratio,
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    style: { transform: `translate(${-scrollX}px, ${-scrollY}px)`, transformOrigin: "top left" },
    filter: (node) => !(node instanceof Element) || !node.hasAttribute(PICKER_ATTR),
  });
  if (options.crop) canvas = crop(canvas, rect, ratio);
  else drawHighlight(canvas, rect, ratio);

  const png = await canvasToBlob(canvas, "image/png");
  if (!png) throw new Error("the screen could not be captured");
  if (png.size > JPEG_FALLBACK_BYTES) {
    const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.85);
    if (jpeg) return new File([jpeg], "mira.jpg", { type: "image/jpeg" });
  }
  return new File([png], "mira.png", { type: "image/png" });
}
