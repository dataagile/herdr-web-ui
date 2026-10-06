/**
 * Asks for a fresh roster without waiting for it. A layout change (focus, resize, zoom) raises no
 * herdr event, so the roster the browsers poll would keep the old layout until the next 5 s read;
 * the route answers with herdr's own layout and never waits on a read loop that busy agents can keep
 * going. A failed or never-settling read is the 5 s poll's to make good.
 */
export function kickRefresh(read: (() => Promise<void>) | undefined): void {
  if (!read) return;
  try { void read().catch(() => undefined); } catch { /* a read that throws at once is no worse */ }
}
