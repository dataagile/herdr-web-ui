/**
 * Behind the Data Agile portal (which signs people in and proxies this app on its own origin) the
 * portal's session is the one that matters: this app only offers a Sign out that ends it. Without
 * the portal `/api/portal/me` is this server's own 404, so anything but the portal's
 * `{ authenticated: true }` JSON means "no portal", and never an error.
 *
 * The same answer says whether the portal takes feedback: `feedback: { enabled, attachments }`.
 * A portal that does not send the field is read as feedback off. An answer that takes over 10 s is read as "no portal":
 * the controls the portal can turn off wait for this answer, so a hang must not hold them back for good.
 *
 * `pc: { name, add_pc }` is what the portal resolved for the target this app serves: `name` is the
 * display name of the local PC and `add_pc: false` turns adding and setting up PCs off. A portal
 * that does not send it (or sends anything but that object) leaves both as they are.
 */

export interface PortalFeedback {
  enabled: boolean;
  /** the picker, the screenshot and the technical data, which also need a desktop-wide window */
  attachments: boolean;
}

export interface PortalPc {
  /** the local PC's display name; null keeps the machine's own */
  name: string | null;
  addPc: boolean;
}

export interface PortalSession {
  portal: boolean;
  feedback: PortalFeedback;
  pc: PortalPc;
}

const NO_PC: PortalPc = { name: null, addPc: true };
const NO_PORTAL: PortalSession = { portal: false, feedback: { enabled: false, attachments: false }, pc: NO_PC };

export async function fetchPortalSession(request: typeof fetch = fetch, timeoutMs = 10_000): Promise<PortalSession> {
  try {
    const response = await request("/api/portal/me", { credentials: "same-origin", headers: { accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
    if (response.status !== 200) return NO_PORTAL;
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || (body as { authenticated?: unknown }).authenticated !== true) return NO_PORTAL;
    const feedback = (body as { feedback?: { enabled?: unknown; attachments?: unknown } | null }).feedback;
    const enabled = feedback?.enabled === true;
    const pc = (body as { pc?: { name?: unknown; add_pc?: unknown } | null }).pc;
    const name = typeof pc?.name === "string" ? pc.name.trim() : "";
    return { portal: true, feedback: { enabled, attachments: enabled && feedback?.attachments === true }, pc: typeof pc === "object" && pc !== null ? { name: name || null, addPc: pc.add_pc !== false } : NO_PC };
  } catch {
    return NO_PORTAL;
  }
}
