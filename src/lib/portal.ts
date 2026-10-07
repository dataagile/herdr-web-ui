/**
 * Behind the Data Agile portal (which signs people in and proxies this app on its own origin) the
 * portal's session is the one that matters: this app only offers a Sign out that ends it. Without
 * the portal `/api/portal/me` is this server's own 404, so anything but the portal's
 * `{ authenticated: true }` JSON means "no portal", and never an error.
 */

export async function detectPortal(request: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await request("/api/portal/me", { credentials: "same-origin", headers: { accept: "application/json" } });
    if (response.status !== 200) return false;
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null && (body as { authenticated?: unknown }).authenticated === true;
  } catch {
    return false;
  }
}
