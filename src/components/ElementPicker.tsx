/**
 * The feedback's picker: a layer over the whole app that follows the pointer. A click selects the
 * element under it, a drag of more than 6 px an area; Escape cancels. The layer takes the pointer
 * itself (so nothing underneath is hovered or activated) and finds the element below it with
 * `elementsFromPoint`. Everything it draws carries `data-feedback-picker`, which the print leaves
 * out. The hint's Cancel button works for touch (no Escape there); a cancelled pointer (pointercancel) drops the press. A click is swallowed once after the press, because ending the press on the layer would
 * otherwise let the browser's synthetic click reach whatever the layer is unmounted from over.
 */
import { Crosshair } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import "./Feedback.css";

import { PRIVATE_SELECTOR, maskedText, type ElementContext } from "../lib/feedback.ts";
import { recentConsole } from "../lib/feedbackBuffer.ts";
import { PICKER_ATTR } from "../lib/feedbackScreenshot.ts";
import { isSensitiveKey, scrubText, scrubUrl } from "../lib/feedbackScrub.ts";
import { useT } from "../lib/i18n.ts";

const DRAG_THRESHOLD_PX = 6;
const MIN_AREA_PX = 4;

interface Point { x: number; y: number }

export interface ElementPickerProps {
  /** true while the print is being made: the hint says so and the layer stops reacting */
  capturing: boolean;
  onSelect: (context: ElementContext, rect: DOMRect) => void;
  onCancel: () => void;
}

function clamp(p: Point): Point {
  return { x: Math.min(Math.max(p.x, 0), window.innerWidth), y: Math.min(Math.max(p.y, 0), window.innerHeight) };
}

function rectOf(rawA: Point, rawB: Point): DOMRect {
  const a = clamp(rawA);
  const b = clamp(rawB);
  return new DOMRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

const labelFor = (el: Element): string => {
  const tag = el.tagName.toLowerCase();
  const first = el.classList.item(0);
  return first ? `${tag}.${first}` : tag;
};

function breadcrumb(el: Element): string {
  const parts: string[] = [];
  for (let node: Element | null = el, i = 0; node && node !== document.body && i < 6; node = node.parentElement, i++) parts.unshift(labelFor(node));
  const joined = parts.join(" > ");
  // truncated at the front: the last segment is the element itself
  return joined.length <= 80 ? joined : `…${joined.slice(joined.length - 79)}`;
}

function dataAttrs(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    if (!attr.name.startsWith("data-") || attr.name === PICKER_ATTR) continue;
    out[scrubText(attr.name)] = isSensitiveKey(attr.name) ? "[TOKEN]" : scrubText(attr.value.slice(0, 100));
  }
  return out;
}

export function buildElementContext(el: Element, modo: "elemento" | "area"): ElementContext {
  const raw = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  // a private surface (conversation, prompt, file content), or an element holding one: only its length leaves
  const isPrivate = el.closest(PRIVATE_SELECTOR) !== null || el.querySelector(PRIVATE_SELECTOR) !== null;
  const inside = el.tagName === "IFRAME" ? "iframe" : el.shadowRoot || el.getRootNode() instanceof ShadowRoot ? "shadow-dom" : undefined;
  return {
    url: scrubUrl(window.location.pathname + window.location.search),
    rota: scrubUrl(window.location.pathname),
    viewport: { w: window.innerWidth, h: window.innerHeight },
    tag: el.tagName.toLowerCase(),
    classes: Array.from(el.classList),
    data_attrs: dataAttrs(el),
    texto_visivel: raw ? maskedText(raw, isPrivate) : null,
    breadcrumb_dom: breadcrumb(el),
    console_errors: recentConsole().map((line) => line.message),
    modo,
    ...(inside ? { dentro_de: inside } : {}),
  };
}

export function ElementPicker({ capturing, onSelect, onCancel }: ElementPickerProps) {
  const t = useT();
  const [target, setTarget] = useState<{ rect: DOMRect; label: string } | null>(null);
  const [marquee, setMarquee] = useState<DOMRect | null>(null);
  // the handlers below live as long as the layer; what they call changes with the parent's renders
  const calls = useRef({ onSelect, onCancel, capturing });
  calls.current = { onSelect, onCancel, capturing };

  useEffect(() => {
    let element: HTMLElement | null = null;
    let down: Point | null = null;
    let pointerId: number | null = null;
    let dragging = false;
    let handled = false;

    // an svg (a lucide icon) or any non-HTML node resolves to the HTML element that holds it
    const under = (x: number, y: number): HTMLElement | null => {
      let node: Element | null = document.elementsFromPoint(x, y).find((el) => el.closest(`[${PICKER_ATTR}]`) === null) ?? null;
      while (node && !(node instanceof HTMLElement)) node = node.parentElement;
      return node;
    };

    const swallowNextClick = (): void => {
      const swallow = (event: MouseEvent): void => { event.preventDefault(); event.stopPropagation(); };
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallow, true), 500);
    };

    const onMove = (event: PointerEvent): void => {
      if (handled || calls.current.capturing) return;
      if (down && event.pointerId !== pointerId) return;
      const here = { x: event.clientX, y: event.clientY };
      if (down) {
        if (!dragging && Math.hypot(here.x - down.x, here.y - down.y) > DRAG_THRESHOLD_PX) dragging = true;
        if (dragging) { setMarquee(rectOf(down, here)); setTarget(null); return; }
      }
      const el = under(here.x, here.y);
      if (!el) return;
      element = el;
      setTarget({ rect: el.getBoundingClientRect(), label: labelFor(el) });
    };

    const onDown = (event: PointerEvent): void => {
      if (handled || down || event.button !== 0 || calls.current.capturing) return;
      if (event.target instanceof Element && event.target.closest(".picker-hint") !== null) return; // the hint's own button
      event.preventDefault();
      event.stopPropagation();
      down = { x: event.clientX, y: event.clientY };
      pointerId = event.pointerId;
      dragging = false;
      element = under(event.clientX, event.clientY) ?? element;
    };

    const onUp = (event: PointerEvent): void => {
      if (handled || !down || event.pointerId !== pointerId) return;
      handled = true;
      swallowNextClick();
      const start = down;
      down = null;
      if (dragging) {
        const rect = rectOf(start, { x: event.clientX, y: event.clientY });
        if (rect.width >= MIN_AREA_PX && rect.height >= MIN_AREA_PX) {
          setMarquee(rect);
          // the area's context comes from the element under its first corner, best effort
          const el = under(rect.left + 1, rect.top + 1) ?? document.body;
          calls.current.onSelect(buildElementContext(el, "area"), rect);
          return;
        }
        setMarquee(null); // a thin drag is no area: it picks the element under the pointer
      }
      if (element) calls.current.onSelect(buildElementContext(element, "elemento"), element.getBoundingClientRect());
      else handled = false;
    };

    const onCancelPointer = (event: PointerEvent): void => {
      if (handled || !down || event.pointerId !== pointerId) return;
      down = null;
      pointerId = null;
      dragging = false;
      setMarquee(null);
    };

    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (!calls.current.capturing) calls.current.onCancel();
    };

    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onCancelPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onCancelPointer, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);

  const box = (rect: DOMRect) => ({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  return (
    <div className="picker-layer" {...{ [PICKER_ATTR]: "layer" }}>
      <div className="picker-dim" />
      {!capturing && target && (
        <div className="picker-target" style={box(target.rect)}>
          <span className="picker-target-tag">{target.label}</span>
        </div>
      )}
      {!capturing && marquee && <div className="picker-target" style={box(marquee)} />}
      <div className="picker-hint" role="status">
        {capturing ? (
          <span>{t("Capturing the screen…")}</span>
        ) : (
          <>
            <Crosshair aria-hidden="true" />
            <span>{t("Click an element or drag to crop")}</span>
            <span className="picker-hint-sep" aria-hidden="true">·</span>
            <kbd className="kbd">Esc</kbd>
            <span>{t("cancels")}</span>
            <button type="button" className="btn btn-ghost picker-cancel" onClick={() => calls.current.onCancel()}>{t("Cancel")}</button>
          </>
        )}
      </div>
    </div>
  );
}
