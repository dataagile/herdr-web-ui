import { beforeEach, describe, expect, it } from "bun:test";

import { buildFeedbackForm, buildTechContext, capElementContext, FeedbackError, MAX_TECH_BYTES, outgoingJson, submitFeedback, type ElementContext, type TechInput } from "./feedback.ts";
import { recentConsole, recentRequests, recordConsole, recordRequest, resetFeedbackBuffer } from "./feedbackBuffer.ts";

const SECRET = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";
const base = (over: Partial<TechInput> = {}): TechInput => ({
  now: new Date("2026-10-08T14:32:10Z"), url: "/p/w1-p1?token=abc&x=1", viewport: { w: 1440, h: 812 }, userAgent: "UA", lang: "pt-BR",
  herdrVersion: "0.5.4", uiRevision: "abc1234", machine: "devbox", paneAgent: "claude", consoleErrors: [], failedRequests: [], ...over,
});

describe("buildTechContext", () => {
  it("masks urls, console lines and request paths before anything is sent", () => {
    const context = buildTechContext(base({
      consoleErrors: [{ level: "error", message: `TypeError: refresh token=zq9s7vw for joao@example.com ${SECRET}` }],
      failedRequests: [{ method: "GET", path: "/api/x?session=secret", status: 500 }],
    }));
    const json = JSON.stringify(context);
    expect(json).not.toContain("zq9s7vw");
    expect(json).not.toContain("joao@example.com");
    expect(json).not.toContain(SECRET);
    expect(json).not.toContain("secret");
    expect(context.url).toBe("/p/w1-p1?token=[Q]&x=[Q]");
    expect(context.failed_requests[0]).toEqual({ method: "GET", path: "/api/x?session=[Q]", status: 500 });
    expect(context.version).toBe(1);
    expect(context.captured_at).toBe("2026-10-08T14:32:10.000Z");
  });

  it("stays under the cap by dropping the oldest entries", () => {
    const lines = Array.from({ length: 400 }, (_, at) => ({ level: "warning" as const, message: `line ${at} ${"x".repeat(450)}` }));
    const requests = Array.from({ length: 400 }, (_, at) => ({ method: "GET", path: `/api/r${at}`, status: 500 }));
    const context = buildTechContext(base({ consoleErrors: lines, failedRequests: requests }));
    expect(new TextEncoder().encode(JSON.stringify(context)).length).toBeLessThanOrEqual(MAX_TECH_BYTES);
    expect(context.console_errors.at(-1)?.message).toStartWith("line 399");
    expect(context.console_errors.length).toBeGreaterThan(0);
    expect(context.console_errors.length).toBeLessThan(400);
  });

  it("honours a smaller cap", () => {
    const context = buildTechContext(base({ consoleErrors: [{ level: "error", message: "a".repeat(300) }, { level: "warning", message: "b".repeat(300) }] }), 650);
    expect(context.console_errors).toEqual([{ level: "warning", message: "b".repeat(300) }]);
  });
});

describe("element context", () => {
  const element = (over: Partial<ElementContext> = {}): ElementContext => ({
    url: "/", rota: "/", viewport: { w: 1, h: 1 }, tag: "button", classes: ["a"], data_attrs: {}, texto_visivel: "ok", breadcrumb_dom: "button", console_errors: [], modo: "elemento", ...over,
  });

  it("drops the bulky parts until it fits 16 KB", () => {
    const big = element({ texto_visivel: "t".repeat(40_000), console_errors: ["e".repeat(500)] });
    const capped = capElementContext(big);
    expect(new TextEncoder().encode(JSON.stringify(capped)).length).toBeLessThanOrEqual(15_000);
    expect(capped.tag).toBe("button");
  });

  it("leaves a small one alone", () => {
    expect(capElementContext(element())).toEqual(element());
  });
});

describe("the payload", () => {
  const tech = buildTechContext(base({ consoleErrors: [{ level: "error", message: "password=hunter2" }] }));
  const element: ElementContext = { url: "/", rota: "/", viewport: { w: 1, h: 1 }, tag: "a", classes: [], data_attrs: {}, texto_visivel: null, breadcrumb_dom: "a", console_errors: [], modo: "area" };

  it("is a multipart form with the fields the portal reads", async () => {
    const image = new File([new Uint8Array([1, 2, 3])], "mira.png", { type: "image/png" });
    const form = buildFeedbackForm({ category: "erro", message: "quebrou", route: "/p/x?token=abc", attachment: image, tech, element });
    expect(form.get("category")).toBe("erro");
    expect(form.get("message")).toBe("quebrou");
    expect(form.get("route")).toBe("/p/x?token=[Q]");
    expect((form.get("attachment") as File).name).toBe("mira.png");
    expect(JSON.parse(form.get("tech_context") as string)).toEqual(tech);
    expect(JSON.parse(form.get("element_context") as string)).toEqual(element);
    expect(String(form.get("tech_context"))).not.toContain("hunter2");
  });

  it("sends no tech_context when the user took it out, and nothing the preview does not show", () => {
    const form = buildFeedbackForm({ category: "melhoria", message: "m", route: "/", attachment: null, tech: null, element: null });
    expect([...form.keys()].sort()).toEqual(["category", "message", "route"]);
    expect(outgoingJson(null, null)).toEqual({});
    expect(outgoingJson(tech, element)).toEqual({ tech_context: tech, element_context: element });
  });
});

describe("submitFeedback", () => {
  const form = new FormData();
  const answer = (status: number, body: unknown = {}): typeof fetch => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("returns the ticket on 201 and posts to the portal with credentials", async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const request = (async (url: string, init?: RequestInit) => { seen.url = url; seen.init = init; return new Response(JSON.stringify({ ticket_id: 7, ticket_url: "https://s/7" }), { status: 201 }); }) as unknown as typeof fetch;
    expect(await submitFeedback(form, request)).toEqual({ ticket_id: 7, ticket_url: "https://s/7" });
    expect(seen.url).toBe("/api/portal/feedback");
    expect(seen.init?.method).toBe("POST");
    expect(seen.init?.credentials).toBe("include");
    expect(seen.init?.body).toBe(form);
  });

  it("carries the status of a refusal, 0 for no answer, 502 for a 201 that is not a ticket", async () => {
    for (const status of [429, 503, 502, 400]) await expect(submitFeedback(form, answer(status))).rejects.toMatchObject({ status });
    await expect(submitFeedback(form, (async () => { throw new TypeError("net"); }) as unknown as typeof fetch)).rejects.toBeInstanceOf(FeedbackError);
    await expect(submitFeedback(form, answer(201, { nope: 1 }))).rejects.toMatchObject({ status: 502 });
  });
});

describe("the ring buffer", () => {
  beforeEach(resetFeedbackBuffer);

  it("masks what it keeps, holds 20 and forgets after five minutes", () => {
    for (let at = 0; at < 25; at++) recordConsole(`n${at} token=abc`, at % 2 ? "warning" : "error", 1000 + at);
    const lines = recentConsole(1000 + 30);
    expect(lines).toHaveLength(20);
    expect(lines.every((line) => line.message.endsWith("token=[TOKEN]"))).toBe(true);
    expect(lines.map((line) => line.level)).toContain("warning");
    expect(recentConsole(1000 + 6 * 60 * 1000)).toEqual([]);
  });

  it("keeps method, masked path and status of a failed request, but not the portal's own", () => {
    recordRequest("post", "/api/pane/send?x=secret", 500, 5);
    recordRequest("GET", "/api/portal/me", 404, 5);
    recordRequest("POST", "/api/portal/feedback", 429, 5);
    expect(recentRequests(10)).toEqual([{ method: "POST", path: "/api/pane/send?x=[Q]", status: 500 }]);
  });
});
