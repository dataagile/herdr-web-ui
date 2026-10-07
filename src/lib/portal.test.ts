import { describe, expect, it } from "bun:test";

import { detectPortal } from "./portal.ts";

const answer = (body: BodyInit | null, status = 200, type = "application/json"): typeof fetch =>
  (async () => new Response(body, { status, headers: { "content-type": type } })) as unknown as typeof fetch;

describe("detectPortal", () => {
  it("is true only for the portal's authenticated JSON", async () => {
    expect(await detectPortal(answer(JSON.stringify({ authenticated: true, user: "a" })))).toBe(true);
    expect(await detectPortal(answer(JSON.stringify({ authenticated: false })))).toBe(false);
    expect(await detectPortal(answer(JSON.stringify({ authenticated: "true" })))).toBe(false);
    expect(await detectPortal(answer("null"))).toBe(false);
  });

  it("is false, quietly, for this app's own 404, other statuses, HTML and a failed request", async () => {
    expect(await detectPortal(answer(JSON.stringify({ error: { code: "not_found" } }), 404))).toBe(false);
    expect(await detectPortal(answer(JSON.stringify({ authenticated: true }), 401))).toBe(false);
    expect(await detectPortal(answer("<html>portal login</html>", 200, "text/html"))).toBe(false);
    expect(await detectPortal((async () => { throw new TypeError("network"); }) as unknown as typeof fetch)).toBe(false);
  });

  it("asks the same origin with the session cookie", async () => {
    const seen: { url?: string; credentials?: string } = {};
    await detectPortal((async (url: string, init?: RequestInit) => { seen.url = url; seen.credentials = init?.credentials; return new Response("{}"); }) as unknown as typeof fetch);
    expect(seen).toEqual({ url: "/api/portal/me", credentials: "same-origin" });
  });
});
