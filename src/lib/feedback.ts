/**
 * The feedback a user sends from the app to the portal that fronts it (`POST /api/portal/feedback`,
 * which the portal turns into a support ticket). Everything that leaves is built here, masked in
 * the browser first (`feedbackScrub.ts`); the herdr server neither sees nor proxies it.
 */
import type { ConsoleLine, FailedRequest } from "./feedbackBuffer.ts";
import { scrubChatText, scrubText, scrubUrl } from "./feedbackScrub.ts";

export type FeedbackCategory = "erro" | "melhoria" | "feedback";

export const FEEDBACK_ENDPOINT = "/api/portal/feedback";
export const TECH_CONTEXT_VERSION = 1;
/** the portal drops a tech_context above 200 KB whole: stay clear of it */
export const MAX_TECH_BYTES = 180_000;
/** the portal drops an element_context above 16 KB whole */
export const MAX_ELEMENT_BYTES = 15_000;
/** the portal answers 422 to a longer route */
export const MAX_ROUTE = 2048;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export interface TechContext {
  version: typeof TECH_CONTEXT_VERSION;
  captured_at: string;
  url: string;
  viewport: { w: number; h: number };
  user_agent: string;
  lang: string;
  herdr_version: string;
  ui_revision: string;
  machine: string;
  pane_agent: string;
  console_errors: ConsoleLine[];
  failed_requests: FailedRequest[];
}

export interface TechInput {
  now: Date;
  /** location path + query, as the browser has it */
  url: string;
  viewport: { w: number; h: number };
  userAgent: string;
  lang: string;
  herdrVersion: string | null;
  uiRevision: string;
  machine: string | null;
  paneAgent: string | null;
  consoleErrors: ConsoleLine[];
  failedRequests: FailedRequest[];
}

const size = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;
const clip = (text: string, max: number): string => scrubText(text).slice(0, max);

/** The technical data, masked, and cut from its oldest entries until it fits the portal's ceiling. */
export function buildTechContext(input: TechInput, maxBytes = MAX_TECH_BYTES): TechContext {
  const context: TechContext = {
    version: TECH_CONTEXT_VERSION,
    captured_at: input.now.toISOString(),
    url: scrubUrl(input.url),
    viewport: input.viewport,
    user_agent: clip(input.userAgent, 512),
    lang: clip(input.lang, 32),
    herdr_version: clip(input.herdrVersion ?? "", 64),
    ui_revision: clip(input.uiRevision, 64),
    machine: clip(input.machine ?? "", 128),
    pane_agent: clip(input.paneAgent ?? "", 64),
    console_errors: input.consoleErrors.map((line) => ({ level: line.level, message: clip(line.message, 500) })),
    failed_requests: input.failedRequests.map((request) => ({ ...request, path: scrubUrl(request.path) })),
  };
  while (size(context) > maxBytes && (context.console_errors.length > 0 || context.failed_requests.length > 0)) {
    if (context.console_errors.length >= context.failed_requests.length) context.console_errors.shift();
    else context.failed_requests.shift();
  }
  return context;
}

/** What the user pointed at: the contract the portal reads (field names are its own). */
export interface ElementContext {
  url: string;
  rota: string;
  viewport: { w: number; h: number };
  tag: string;
  classes: string[];
  data_attrs: Record<string, string>;
  texto_visivel: string | null;
  breadcrumb_dom: string;
  console_errors: string[];
  modo: "elemento" | "area";
  dentro_de?: "shadow-dom" | "iframe";
}

/** Shrinks the element context, the bulkiest parts first, until it fits; the last steps bound every field, so the result always fits. */
export function capElementContext(context: ElementContext, maxBytes = MAX_ELEMENT_BYTES): ElementContext {
  const next = { ...context };
  for (const step of [
    () => { next.texto_visivel = null; },
    () => { next.data_attrs = {}; },
    () => { next.console_errors = []; },
    () => { next.classes = next.classes.slice(0, 8); next.breadcrumb_dom = next.breadcrumb_dom.slice(-200); },
    () => { delete next.dentro_de; next.classes = []; next.breadcrumb_dom = ""; },
    () => { next.url = next.url.slice(0, 256); next.rota = next.rota.slice(0, 256); next.tag = next.tag.slice(0, 64); },
  ]) {
    if (size(next) <= maxBytes) break;
    step();
  }
  return next;
}

/**
 * Every surface that shows conversation, prompt or file content (chat, composer, prompt cards,
 * history rows, file viewer, terminal) carries this attribute; text inside or holding such a node
 * leaves only as its length.
 */
export const PRIVATE_ATTR = "data-feedback-private";
export const PRIVATE_SELECTOR = `[${PRIVATE_ATTR}]`;
/** the text of an element outside the private surfaces is cut to this many characters */
export const MAX_ELEMENT_TEXT = 200;

/** the most of an element's text that is scrubbed: a whole page's text is not scrubbed to keep 200 chars */
const MAX_SCRUB_WINDOW = 8 * 1024;

/**
 * `text` is the whole visible text, whitespace already collapsed. Scrubbed on a bounded window
 * (cut back to a word boundary, so a secret is never split by the window), then cut to 200: the
 * 200 chars come from the masked text, so a secret across the 200th char cannot survive half-masked.
 */
export function maskedText(text: string, isPrivate: boolean): string {
  if (isPrivate) return scrubChatText(text);
  let window = text.slice(0, MAX_SCRUB_WINDOW);
  if (text.length > MAX_SCRUB_WINDOW) window = window.slice(0, Math.max(window.lastIndexOf(" "), 0));
  const masked = scrubText(window);
  return masked.length > MAX_ELEMENT_TEXT ? `${masked.slice(0, MAX_ELEMENT_TEXT)}…` : masked;
}

/** The JSON the dialog previews is the JSON that is sent: this is the one place that decides it. */
export function outgoingJson(tech: TechContext | null, element: ElementContext | null): { tech_context?: TechContext; element_context?: ElementContext } {
  return { ...(tech ? { tech_context: tech } : {}), ...(element ? { element_context: capElementContext(element) } : {}) };
}

export interface FeedbackInput {
  category: FeedbackCategory;
  message: string;
  /** location path + query; masked here */
  route: string;
  attachment: File | null;
  tech: TechContext | null;
  element: ElementContext | null;
}

export function buildFeedbackForm(input: FeedbackInput): FormData {
  const form = new FormData();
  form.append("category", input.category);
  form.append("message", input.message);
  form.append("route", scrubUrl(input.route).slice(0, MAX_ROUTE));
  const { tech_context, element_context } = outgoingJson(input.tech, input.element);
  if (element_context) form.append("element_context", JSON.stringify(element_context));
  if (tech_context) form.append("tech_context", JSON.stringify(tech_context));
  if (input.attachment) form.append("attachment", input.attachment);
  return form;
}

export interface FeedbackResult {
  /** null when the portal answered 201 without them: the ticket exists, there is just no number or link to show */
  ticket_id: number | null;
  ticket_url: string | null;
  attachment_error?: string | null;
  tech_context_error?: string | null;
}

export class FeedbackError extends Error {
  constructor(readonly status: number, readonly code: string | null = null, readonly retryAfter: number | null = null) {
    super(`feedback ${status}`);
  }
}

export async function submitFeedback(form: FormData, request: typeof fetch = fetch): Promise<FeedbackResult> {
  let response: Response;
  try {
    response = await request(FEEDBACK_ENDPOINT, { method: "POST", body: form, credentials: "include" });
  } catch {
    throw new FeedbackError(0);
  }
  if (response.status !== 201) {
    // the portal's error body is `{ error: { code, message } }`; 504 `glpi_timeout` means the ticket may exist
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const code = typeof body?.error === "object" && body.error !== null ? (body.error as { code?: unknown }).code : undefined;
    const wait = Number(response.headers.get("retry-after"));
    throw new FeedbackError(code === "glpi_timeout" ? 504 : response.status, typeof code === "string" ? code : null, Number.isFinite(wait) && wait > 0 ? Math.ceil(wait) : null);
  }
  // a 201 is a ticket: an answer without its number or link is still one, and is never an invitation to send again
  const body = (await response.json().catch(() => null)) as Partial<FeedbackResult> | null;
  if (typeof body?.ticket_id !== "number" || typeof body.ticket_url !== "string") return { ticket_id: null, ticket_url: null, attachment_error: body?.attachment_error ?? null, tech_context_error: body?.tech_context_error ?? null };
  return body as FeedbackResult;
}
