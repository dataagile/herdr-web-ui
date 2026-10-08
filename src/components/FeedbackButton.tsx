/**
 * The header's feedback button (a megaphone, just before the bell): a menu of three categories,
 * each opening FeedbackDialog. It owns the draft so the picker can take the dialog down (the
 * print must not show it) and give it back, with what was typed, the print and the element that
 * was pointed at. Rendered only behind the portal and only when the portal says feedback is on;
 * the picker, the print and the technical data also need a window at least 1024px wide.
 */
import { Bug, Lightbulb, Megaphone, MessageSquareText } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { buildTechContext, type ElementContext, type FeedbackCategory } from "../lib/feedback.ts";
import { recentConsole, recentRequests } from "../lib/feedbackBuffer.ts";
import { captureScreen } from "../lib/feedbackScreenshot.ts";
import { currentBuild } from "../lib/buildInfo.ts";
import { useT } from "../lib/i18n.ts";
import type { PortalFeedback } from "../lib/portal.ts";
import { useMediaQuery } from "../lib/useMediaQuery.ts";
import { ElementPicker } from "./ElementPicker.tsx";
import { FeedbackDialog, type FeedbackDraft } from "./FeedbackDialog.tsx";
import { RowMenu, type RowMenuItem } from "./RowMenu.tsx";

export interface FeedbackMeta {
  herdrVersion: string | null;
  machine: string | null;
  paneAgent: string | null;
}

interface Props {
  availability: PortalFeedback;
  meta: FeedbackMeta;
}

const EMPTY: FeedbackDraft = { message: "", file: null, picked: false, element: null, tech: null, includeTech: true, notice: null };

export function FeedbackButton({ availability, meta }: Props) {
  const t = useT();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const rich = availability.attachments && desktop;
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [draft, setDraft] = useState<FeedbackDraft>(EMPTY);
  const [picking, setPicking] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const capturingRef = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const metaRef = useRef(meta);
  metaRef.current = meta;

  const labels: Record<FeedbackCategory, string> = { erro: t("Report a bug"), melhoria: t("Suggest an improvement"), feedback: t("General feedback") };

  // read when the form opens and again at the pick: the data is the screen's state at that moment
  const snapshot = useCallback(() => {
    try {
      const { herdrVersion, machine, paneAgent } = metaRef.current;
      return buildTechContext({
        now: new Date(), url: window.location.pathname + window.location.search, viewport: { w: window.innerWidth, h: window.innerHeight },
        userAgent: navigator.userAgent, lang: navigator.language, herdrVersion, uiRevision: currentBuild().commit, machine, paneAgent,
        consoleErrors: recentConsole(), failedRequests: recentRequests(),
      });
    } catch (reason) {
      console.error("feedback: could not read the technical data", reason);
      return null;
    }
  }, []);

  const open = (next: FeedbackCategory): void => {
    setDraft({ ...EMPTY, tech: rich ? snapshot() : null });
    setCategory(next);
  };

  const close = useCallback(() => {
    setCategory(null);
    window.requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  }, []);

  const cancelPicking = useCallback(() => setPicking(false), []);

  const select = useCallback(async (context: ElementContext, rect: DOMRect) => {
    if (capturingRef.current) return;
    capturingRef.current = true;
    setCapturing(true);
    const tech = snapshot();
    try {
      const file = await captureScreen(rect, { crop: context.modo === "area" });
      setDraft((d) => ({ ...d, file, picked: true, element: context, tech, notice: null }));
    } catch (reason) {
      console.error("feedback: could not capture the screen", reason);
      // what was typed, and an image chosen by hand before, stay; the element still goes
      setDraft((d) => ({ ...d, element: context, tech, notice: t("Could not capture the screen.") }));
    } finally {
      capturingRef.current = false;
      setCapturing(false);
      setPicking(false);
    }
  }, [snapshot, t]);

  if (!availability.enabled) return null;

  const icons = { erro: Bug, melhoria: Lightbulb, feedback: MessageSquareText } as const;
  const items: RowMenuItem[] = (["erro", "melhoria", "feedback"] as const).map((id) => ({ id, label: labels[id], icon: icons[id], run: () => open(id) }));

  return (
    <>
      <button ref={trigger} type="button" className="icon-button header-feedback" aria-label={t("Send feedback")} title={t("Send feedback")} aria-haspopup="menu" aria-expanded={menuAnchor !== null} onClick={(event) => setMenuAnchor(menuAnchor ? null : event.currentTarget)}>
        <Megaphone aria-hidden="true" />
      </button>
      {menuAnchor && <RowMenu anchor={menuAnchor} title={t("Send feedback")} items={items} onClose={() => setMenuAnchor(null)} />}
      {picking && createPortal(<ElementPicker capturing={capturing} onSelect={(context, rect) => void select(context, rect)} onCancel={cancelPicking} />, document.body)}
      {category && !picking && createPortal(
        <FeedbackDialog
          category={category}
          title={labels[category]}
          draft={draft}
          attachments={availability.attachments}
          rich={rich}
          onChange={setDraft}
          onPick={() => setPicking(true)}
          onClose={close}
        />,
        document.body,
      )}
    </>
  );
}
