import { describe, expect, it } from "bun:test";

import { fetchPortalSession } from "./dataAgilePortal.ts";

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

  it("gives up on an answer that never comes", async () => {
    const hung = ((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)))) as unknown as typeof fetch;
    expect(await fetchPortalSession(hung, 20)).toEqual({ portal: false, feedback: { enabled: false, attachments: false }, pc: { name: null, addPc: true } });
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

describe("fetchPortalSession pc", () => {
  const me = (pc?: unknown) => answer(JSON.stringify({ authenticated: true, ...(pc === undefined ? {} : { pc }) }));
  const unchanged = { name: null, addPc: true };

  it("leaves the PC as it is without the portal, without the field or with something that is not an object", async () => {
    expect((await fetchPortalSession(answer("{}", 404))).pc).toEqual(unchanged);
    expect((await fetchPortalSession(me())).pc).toEqual(unchanged);
    expect((await fetchPortalSession(me(null))).pc).toEqual(unchanged);
    expect((await fetchPortalSession(me("add_pc"))).pc).toEqual(unchanged);
    expect((await fetchPortalSession(me(false))).pc).toEqual(unchanged);
  });

  it("turns Add PC off only for add_pc: false", async () => {
    expect((await fetchPortalSession(me({ name: null, add_pc: false }))).pc.addPc).toBe(false);
    expect((await fetchPortalSession(me({ name: null, add_pc: true }))).pc.addPc).toBe(true);
    expect((await fetchPortalSession(me({ name: null }))).pc.addPc).toBe(true);
    expect((await fetchPortalSession(me({ name: null, add_pc: "false" }))).pc.addPc).toBe(true);
    expect((await fetchPortalSession(me({ name: null, add_pc: 0 }))).pc.addPc).toBe(true);
  });

  it("reads the local PC's name only when it is a non-empty string", async () => {
    expect((await fetchPortalSession(me({ name: "Notebook da Ana", add_pc: true }))).pc.name).toBe("Notebook da Ana");
    expect((await fetchPortalSession(me({ name: "  Ana  " }))).pc.name).toBe("Ana");
    for (const name of [null, "", "   ", 7, {}]) expect((await fetchPortalSession(me({ name }))).pc.name).toBeNull();
  });
});
