/**
 * The feedback form, opened from the header's megaphone: a description, an optional image (one
 * chosen, or the print the picker made), and, on a desktop-wide window, the technical data with a
 * preview of the exact JSON that will leave. The picker itself lives in FeedbackButton, which
 * takes this dialog down while it runs and gives the draft back; the form owns only what is
 * typed and the send. The success state replaces the form and leaves Close.
 */
import { CircleCheck, Crosshair, ExternalLink, Image as ImageIcon, Trash2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent } from "react";

import "./Feedback.css";

import { buildFeedbackForm, FeedbackError, IMAGE_TYPES, MAX_IMAGE_BYTES, outgoingJson, submitFeedback, type ElementContext, type FeedbackCategory, type FeedbackResult, type TechContext } from "../lib/feedback.ts";
import { formatBytes } from "../lib/bridgeProgress.ts";
import { scrubSecrets } from "../lib/feedbackScrub.ts";
import { useT } from "../lib/i18n.ts";

export interface FeedbackDraft {
  message: string;
  file: File | null;
  /** the print came from the picker (and `element` says what was pointed at) */
  picked: boolean;
  element: ElementContext | null;
  tech: TechContext | null;
  includeTech: boolean;
  /** a failure that happened outside the form (the print could not be made) */
  notice: string | null;
}

interface Props {
  category: FeedbackCategory;
  title: string;
  draft: FeedbackDraft;
  /** the image field: the portal accepts attachments */
  attachments: boolean;
  /** the picker, the print and the technical data: attachments, on a desktop-wide window */
  rich: boolean;
  onChange: (draft: FeedbackDraft) => void;
  onPick: () => void;
  onClose: () => void;
}

/** The ticket link comes from the portal; only a web address is ever made a link. */
function safeLink(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

export function FeedbackDialog({ category, title, draft, attachments, rich, onChange, onPick, onClose }: Props) {
  const t = useT();
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [sending, setSending] = useState(false);
  // a failure from outside the form is shown once: the draft forgets it as soon as it is read
  const [error, setError] = useState<string | null>(draft.notice);
  useEffect(() => { if (draft.notice !== null) onChange({ ...draft, notice: null }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // 504: the ticket may exist; no automatic retry, and Send stops inviting one until the text changes
  const [uncertain, setUncertain] = useState(false);
  // 503 busy: Send waits out the portal's Retry-After, once; nothing is resent on its own
  const [busyFor, setBusyFor] = useState(0);
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const set = (patch: Partial<FeedbackDraft>): void => onChange({ ...draft, ...patch });

  const previewUrl = useMemo(() => (draft.file ? URL.createObjectURL(draft.file) : null), [draft.file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      event.preventDefault();
      if (!sending) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, sending]);
  useEffect(() => {
    if (busyFor === 0) return;
    const timer = window.setTimeout(() => setBusyFor(0), busyFor * 1000);
    return () => window.clearTimeout(timer);
  }, [busyFor]);
  useEffect(() => { if (result) closeButton.current?.focus(); }, [result]);

  // unchecked, neither the technical data nor the element leaves: the preview and the send read the same two values
  const share = rich && draft.includeTech;
  const sentTech = share ? draft.tech : null;
  const sentElement = share ? draft.element : null;
  // the description as it will arrive: the portal masks its secrets (tokens, keys, passwords) and nothing else
  const preview = useMemo(() => JSON.stringify({ description: scrubSecrets(draft.message.trim()), ...outgoingJson(sentTech, sentElement) }, null, 2), [draft.message, sentTech, sentElement]);
  const route = window.location.pathname + window.location.search;
  const canSend = draft.message.trim() !== "" && !sending && busyFor === 0;

  const chooseFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      setError(t("Choose a PNG, JPEG, GIF or WebP image up to 10 MB."));
      return;
    }
    setError(null);
    set({ file, picked: false, element: null });
  };

  const send = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!canSend) return;
    setSending(true);
    setError(null);
    setUncertain(false);
    try {
      setResult(await submitFeedback(buildFeedbackForm({ category, message: draft.message.trim(), route, attachment: draft.file, tech: sentTech, element: sentElement })));
    } catch (reason) {
      const status = reason instanceof FeedbackError ? reason.status : 0;
      const busy = reason instanceof FeedbackError && status === 503 && reason.code === "busy";
      const wait = Math.min(Math.max(reason instanceof FeedbackError ? reason.retryAfter ?? 5 : 5, 1), 120);
      if (status === 504) setUncertain(true);
      if (busy) setBusyFor(wait);
      setError(busy ? t("The portal is busy; try again in {n} s.", { n: wait }) : status === 504 ? t("The support system took too long to answer; the ticket may have been created. Check before sending again.") : status === 429 ? t("Too many submissions. Try again in a few minutes.") : status === 413 ? t("Image too large (max. 10 MB).") : status === 503 ? t("Feedback is unavailable right now.") : t("Could not open the ticket. Try again."));
    } finally {
      setSending(false);
    }
  };

  const closeFromScrim = (event: MouseEvent<HTMLDivElement>): void => {
    if (!sending && event.target === event.currentTarget) onClose();
  };

  const header = (
    <header className="modal-header">
      <h2 className="modal-title" id={`${id}-title`}>{title}</h2>
      <button type="button" className="icon-button" aria-label={t("Close dialog")} disabled={sending} onClick={onClose}><X aria-hidden="true" /></button>
    </header>
  );

  if (result) {
    const link = safeLink(result.ticket_url);
    return (
      <div className="modal-scrim" onMouseDown={closeFromScrim}>
        <div className="modal feedback-modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
          {header}
          <div className="modal-body feedback-success" role="status">
            <p className="new-session-note">{t("Ticket opened with the Data Agile team.")}</p>
            <div className="feedback-success-main">
              <span className="feedback-success-icon"><CircleCheck aria-hidden="true" /></span>
              <div>
                <p className="feedback-success-title">{t("Ticket #{n} opened", { n: result.ticket_id })}</p>
                <p className="field-hint">{t("Thank you. The Data Agile team already has your report.")}</p>
                {result.attachment_error && <p className="field-hint">{result.attachment_error}</p>}
                {result.tech_context_error && <p className="field-hint">{result.tech_context_error}</p>}
              </div>
            </div>
            {link && <a className="feedback-link" href={link} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />{t("Open in support")}</a>}
          </div>
          <footer className="modal-footer"><button ref={closeButton} type="button" className="btn btn-primary" onClick={onClose}>{t("Close")}</button></footer>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-scrim" onMouseDown={closeFromScrim}>
      <form className="modal feedback-modal" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onSubmit={(event) => void send(event)}>
        {header}
        <div className="modal-body">
          <p className="new-session-note">{t("Describe it in detail. The Data Agile team receives it as a ticket.")}</p>
          <div className="field">
            <label className="field-label" htmlFor={`${id}-message`}>{t("Description (required)")}</label>
            <textarea id={`${id}-message`} className="input feedback-textarea" rows={5} autoFocus required disabled={sending} value={draft.message} placeholder={t("Describe the error, the suggestion or your feedback…")} onChange={(event) => { setUncertain(false); set({ message: event.target.value }); }} />
          </div>
          {attachments && (
            <div className="field">
              <span className="field-label" id={`${id}-image`}>{t("Image (optional, up to 10 MB)")}</span>
              <div className="feedback-image-actions">
                <input ref={fileInput} type="file" accept={IMAGE_TYPES.join(",")} hidden aria-labelledby={`${id}-image`} onChange={chooseFile} />
                <button type="button" className="btn" disabled={sending} onClick={() => fileInput.current?.click()}><ImageIcon aria-hidden="true" />{t("Choose image")}</button>
                {rich && !draft.picked && <button type="button" className="btn" disabled={sending} onClick={onPick}><Crosshair aria-hidden="true" />{t("Select element on screen")}</button>}
              </div>
              {draft.element && <p className="field-hint">{draft.element.modo === "area" ? t("Area selected on the screen") : t("Element selected: {name}", { name: draft.element.breadcrumb_dom.split(" > ").at(-1) || draft.element.tag })}</p>}
              {draft.file && previewUrl ? (
                <figure className="feedback-thumb">
                  <img src={previewUrl} alt={t("Attachment preview")} />
                  <figcaption>
                    <span className="field-hint">{draft.file.name} · {formatBytes(draft.file.size)}</span>
                    <span className="feedback-thumb-actions">
                      <button type="button" className="btn btn-ghost" disabled={sending} onClick={() => set({ file: null, picked: false, element: null })}><Trash2 aria-hidden="true" />{t("Remove")}</button>
                      {draft.picked && <button type="button" className="btn" disabled={sending} onClick={onPick}><Crosshair aria-hidden="true" />{t("Redo")}</button>}
                    </span>
                  </figcaption>
                </figure>
              ) : (
                !draft.element && <span className="field-hint">{t("No file chosen")}</span>
              )}
            </div>
          )}
          {rich && (
            <div className="field feedback-tech">
              <label className="feedback-check">
                <input type="checkbox" checked={draft.includeTech} disabled={sending} onChange={(event) => set({ includeTech: event.target.checked })} />
                <span>{t("Include technical data in the ticket")}</span>
              </label>
              <span className="field-hint">{t("They help the team understand what happened. Passwords, tokens and documents in the technical data are masked before they leave the browser. Tokens, passwords and keys in the description are masked by the support system. The screenshot shows the screen as it is: check that no sensitive data is visible before sending.")}</span>
              <details className="feedback-details">
                <summary>{t("See what will be sent")}</summary>
                <pre className="feedback-json" tabIndex={0}>{preview}</pre>
              </details>
            </div>
          )}
          {error && <p className="field-hint new-session-error" role="alert">{error}</p>}
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn btn-ghost" disabled={sending} onClick={onClose}>{t("Cancel")}</button>
          <button type="submit" className={uncertain ? "btn" : "btn btn-primary"} disabled={!canSend}>{sending ? t("Sending…") : uncertain ? t("Send anyway") : t("Send")}</button>
        </footer>
      </form>
    </div>
  );
}
