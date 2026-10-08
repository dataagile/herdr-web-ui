import { describe, expect, it } from "bun:test";

import { fetchPortalSession } from "./portal.ts";

const answer = (body: BodyInit | null, status = 200, type = "application/json"): typeof fetch =>
  (async () => new Response(body, { status, headers: { "content-type": type } })) as unknown as typeof fetch;

describe("fetchPortalSession portal", () => {
  it("is true only for the portal's authenticated JSON", async () => {
    expect((await fetchPortalSession(answer(JSON.stringify({ authenticated: true, user: "a" })))).portal).toBe(true);
    expect((await fetchPortalSession(answer(JSON.stringify({ authenticated: false })))).portal).toBe(false);
    expect((await fetchPortalSession(answer(JSON.stringify({ authenticated: "true" })))).portal).toBe(false);
    expect((await fetchPortalSession(answer("null"))).portal).toBe(false);
  });

  it("is false, quietly, for this app's own 404, other statuses, HTML and a failed request", async () => {
    expect((await fetchPortalSession(answer(JSON.stringify({ error: { code: "not_found" } }), 404))).portal).toBe(false);
    expect((await fetchPortalSession(answer(JSON.stringify({ authenticated: true }), 401))).portal).toBe(false);
    expect((await fetchPortalSession(answer("<html>portal login</html>", 200, "text/html"))).portal).toBe(false);
    expect((await fetchPortalSession((async () => { throw new TypeError("network"); }) as unknown as typeof fetch)).portal).toBe(false);
  });

  it("asks the same origin with the session cookie", async () => {
    const seen: { url?: string; credentials?: string } = {};
    await fetchPortalSession((async (url: string, init?: RequestInit) => { seen.url = url; seen.credentials = init?.credentials; return new Response("{}"); }) as unknown as typeof fetch);
    expect(seen).toEqual({ url: "/api/portal/me", credentials: "same-origin" });
  });
});

describe("fetchPortalSession feedback", () => {
  const me = (feedback?: unknown) => answer(JSON.stringify({ authenticated: true, ...(feedback === undefined ? {} : { feedback }) }));

  it("reads feedback from the portal's answer", async () => {
    expect((await fetchPortalSession(me({ enabled: true, attachments: true }))).feedback).toEqual({ enabled: true, attachments: true });
    expect((await fetchPortalSession(me({ enabled: true, attachments: false }))).feedback).toEqual({ enabled: true, attachments: false });
  });

  it("is off when the portal does not say, says it off, or sends something else", async () => {
    const off = { enabled: false, attachments: false };
    expect((await fetchPortalSession(me())).feedback).toEqual(off);
    expect((await fetchPortalSession(me(null))).feedback).toEqual(off);
    expect((await fetchPortalSession(me({ enabled: "true", attachments: true }))).feedback).toEqual(off);
    expect((await fetchPortalSession(me({ enabled: false, attachments: true }))).feedback).toEqual(off);
    expect((await fetchPortalSession(answer("{}", 404))).feedback).toEqual(off);
  });
});
