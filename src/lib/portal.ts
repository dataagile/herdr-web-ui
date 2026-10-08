/**
 * Behind the Data Agile portal (which signs people in and proxies this app on its own origin) the
 * portal's session is the one that matters: this app only offers a Sign out that ends it. Without
 * the portal `/api/portal/me` is this server's own 404, so anything but the portal's
 * `{ authenticated: true }` JSON means "no portal", and never an error.
 *
 * The same answer says whether the portal takes feedback: `feedback: { enabled, attachments }`.
 * A portal that does not send the field is read as feedback off.
 */

export interface PortalFeedback {
  enabled: boolean;
  /** the picker, the screenshot and the technical data, which also need a desktop-wide window */
  attachments: boolean;
}

export interface PortalSession {
  portal: boolean;
  feedback: PortalFeedback;
}

const NO_PORTAL: PortalSession = { portal: false, feedback: { enabled: false, attachments: false } };

export async function fetchPortalSession(request: typeof fetch = fetch): Promise<PortalSession> {
  try {
    const response = await request("/api/portal/me", { credentials: "same-origin", headers: { accept: "application/json" } });
    if (response.status !== 200) return NO_PORTAL;
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || (body as { authenticated?: unknown }).authenticated !== true) return NO_PORTAL;
    const feedback = (body as { feedback?: { enabled?: unknown; attachments?: unknown } | null }).feedback;
    const enabled = feedback?.enabled === true;
    return { portal: true, feedback: { enabled, attachments: enabled && feedback?.attachments === true } };
  } catch {
    return NO_PORTAL;
  }
}

export async function detectPortal(request: typeof fetch = fetch): Promise<boolean> {
  return (await fetchPortalSession(request)).portal;
}
