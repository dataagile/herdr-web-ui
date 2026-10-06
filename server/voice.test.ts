import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VOICE_MAX_AUDIO_BYTES, type VoiceEvent, type VoiceStatus } from "../shared/voice.ts";
import { handleVoiceRequest, VoiceService } from "./voice.ts";

const KEY = "sk-test-0123456789abcdef";

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

let stateDir: string;
let requests: Array<{ url: string; init: RequestInit }>;
let handler: Handler;

function service(env: Record<string, string | undefined> = {}): VoiceService {
  return new VoiceService({
    stateDir, env,
    async fetch(url, init) {
      requests.push({ url, init });
      return handler(url, init);
    },
  });
}

function call(voice: VoiceService, pathname: string, init: RequestInit = {}): Promise<Response> {
  return handleVoiceRequest(new Request(`http://localhost${pathname}`, init), pathname, voice);
}

const put = (voice: VoiceService, body: unknown) => call(voice, "/api/voice/config", { method: "PUT", body: JSON.stringify(body) });

function clipForm(fields: { audio?: Blob | null; name?: string; mode?: string; polish?: string; keywords?: string; language?: string } = {}): FormData {
  const form = new FormData();
  const audio = fields.audio === undefined ? new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm;codecs=opus" }) : fields.audio;
  if (audio) form.append("audio", audio, fields.name ?? "clip.webm");
  form.append("mode", fields.mode ?? "chat");
  form.append("polish", fields.polish ?? "0");
  if (fields.keywords !== undefined) form.append("keywords", fields.keywords);
  if (fields.language !== undefined) form.append("language", fields.language);
  return form;
}

const transcribe = (voice: VoiceService, form: FormData) => call(voice, "/api/voice/transcribe", { method: "POST", body: form });

async function events(response: Response): Promise<VoiceEvent[]> {
  return (await response.text()).split("\n").filter(Boolean).map((line) => JSON.parse(line) as VoiceEvent);
}

/** an SSE answer cut at fixed byte offsets: mid-line and mid-character */
function sse(events: unknown[], cuts: number[]): Response {
  const bytes = new TextEncoder().encode(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""));
  const bounds = [0, ...cuts, bytes.length];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i + 1 < bounds.length; i++) controller.enqueue(bytes.slice(bounds[i], bounds[i + 1]));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream" } });
}

const DELTAS = ["안녕하세요 ", "git status ", "실행해 줘"];
function transcriptAnswer(): Response {
  return sse([
    ...DELTAS.map((delta) => ({ type: "transcript.text.delta", delta })),
    { type: "transcript.text.done", text: DELTAS.join("") },
  ], [7, 40, 61, 95, 150]);
}

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "herdr-web-ui-voice-"));
  requests = [];
  handler = () => new Response("unexpected", { status: 500 });
});

afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

describe("voice config", () => {
  it("reports no key and the defaults when nothing is set", async () => {
    const response = await call(service(), "/api/voice");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      configured: false, key_stored: false, source: null, base_url: "https://api.openai.com/v1", transcribe_model: "gpt-transcribe", polish_model: "gpt-6-luna",
      polish_enabled: true, language: null, error: null,
    } satisfies VoiceStatus);
  });

  it("takes the env key and refuses to change it", async () => {
    const voice = service({ HERDR_WEB_OPENAI_API_KEY: KEY });
    const status = await (await call(voice, "/api/voice")).json() as VoiceStatus;
    expect(status).toMatchObject({ configured: true, source: "env" });
    for (const api_key of ["sk-other", null]) {
      const response = await put(voice, { api_key });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: { code: "key_from_env" } });
    }
  });

  it("never sends a key to a base_url it was not saved with", async () => {
    writeFileSync(join(stateDir, "voice.json"), JSON.stringify({ base_url: "http://attacker.invalid/v1" }));
    const fromEnv = service({ HERDR_WEB_OPENAI_API_KEY: KEY });
    expect((await (await call(fromEnv, "/api/voice")).json() as VoiceStatus).base_url).toBe("https://api.openai.com/v1");
    const moved = await put(fromEnv, { base_url: "http://attacker.invalid/v1" });
    expect(moved.status).toBe(409);
    expect(await moved.json()).toMatchObject({ error: { code: "key_from_env" } });

    rmSync(join(stateDir, "voice.json"));
    const fromFile = service();
    expect((await put(fromFile, { api_key: KEY })).status).toBe(200);
    const alone = await put(fromFile, { base_url: "http://attacker.invalid/v1" });
    expect(alone.status).toBe(400);
    expect(await alone.json()).toMatchObject({ error: { code: "invalid_request" } });
    expect((await (await call(fromFile, "/api/voice")).json() as VoiceStatus).base_url).toBe("https://api.openai.com/v1");
    expect((await put(fromFile, { api_key: "sk-new-key", base_url: "http://127.0.0.1:9/v1" })).status).toBe(200);
  });

  it("stores the key owner-only and never answers it", async () => {
    const voice = service();
    const saved = await put(voice, { api_key: ` ${KEY} `, base_url: "http://127.0.0.1:9/v1/" });
    expect(saved.status).toBe(200);
    expect(await saved.text()).not.toContain(KEY);
    const path = join(stateDir, "voice.json");
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(path, "utf8"))).toMatchObject({ api_key: KEY });
    const body = await (await call(voice, "/api/voice")).text();
    expect(body).not.toContain(KEY);
    expect(JSON.parse(body)).toMatchObject({ configured: true, source: "file", base_url: "http://127.0.0.1:9/v1" });
  });

  it("removes the key with null", async () => {
    const voice = service();
    await put(voice, { api_key: KEY });
    const response = await put(voice, { api_key: null });
    expect(await response.json()).toMatchObject({ configured: false, source: null });
    expect(readFileSync(join(stateDir, "voice.json"), "utf8")).not.toContain(KEY);
  });

  it("refuses a base_url that is not http(s) and a wrong method", async () => {
    const voice = service();
    const response = await put(voice, { base_url: "ftp://example.com" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_request" } });
    const wrong = await call(voice, "/api/voice", { method: "POST" });
    expect(wrong.status).toBe(405);
    expect(wrong.headers.get("allow")).toBe("GET");
  });
});

describe("voice transcribe", () => {
  it("refuses without a key", async () => {
    const response = await transcribe(service(), clipForm());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "voice_not_configured" } });
    expect(requests).toHaveLength(0);
  });

  it("refuses an oversize clip", async () => {
    const response = await transcribe(service({ HERDR_WEB_OPENAI_API_KEY: KEY }), clipForm({ audio: new Blob([new Uint8Array(VOICE_MAX_AUDIO_BYTES + 1)], { type: "audio/webm" }) }));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "audio_too_large" } });
  });

  it("stops reading a body without a length once it passes the limit", async () => {
    let pulled = 0;
    const chunk = new Uint8Array(1024 * 1024);
    const chunks = Math.ceil(VOICE_MAX_AUDIO_BYTES / chunk.byteLength) + 8;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled >= chunks * chunk.byteLength) { controller.close(); return; }
        pulled += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
    const request = new Request("http://127.0.0.1/api/voice/transcribe", {
      method: "POST", body, headers: { "content-type": "multipart/form-data; boundary=x" }, duplex: "half",
    } as RequestInit);
    const response = await handleVoiceRequest(request, "/api/voice/transcribe", service({ HERDR_WEB_OPENAI_API_KEY: KEY }));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "audio_too_large" } });
    expect(pulled).toBeLessThan(VOICE_MAX_AUDIO_BYTES + 4 * chunk.byteLength);
  });

  it("refuses a missing audio part", async () => {
    const response = await transcribe(service({ HERDR_WEB_OPENAI_API_KEY: KEY }), clipForm({ audio: null }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_audio" } });
  });

  it("asks for the speaker's language and English, Korean when the client names none", async () => {
    const asked: string[][] = [];
    handler = async (_url, init) => { asked.push((init.body as FormData).getAll("languages[]") as string[]); return transcriptAnswer(); };
    const voice = service({ HERDR_WEB_OPENAI_API_KEY: KEY });
    for (const language of ["ja", "zh", "en", undefined]) await events(await transcribe(voice, clipForm({ language })));
    expect(asked).toEqual([["ja", "en"], ["zh", "en"], ["en"], ["ko", "en"]]);
    const bad = await transcribe(voice, clipForm({ language: "japanese" }));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: { code: "invalid_request" } });
  });

  it("refuses a bad mode", async () => {
    const response = await transcribe(service({ HERDR_WEB_OPENAI_API_KEY: KEY }), clipForm({ mode: "shell" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_request" } });
  });

  it("streams deltas and the done text from a split SSE answer", async () => {
    handler = transcriptAnswer;
    const keywords = JSON.stringify([" git ", "git", "", "server/voice.ts", "x".repeat(81)]);
    const response = await transcribe(service({ HERDR_WEB_OPENAI_API_KEY: KEY }), clipForm({ keywords, mode: "terminal" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(await events(response)).toEqual([
      ...DELTAS.map((text) => ({ type: "delta" as const, text })),
      { type: "done", text: DELTAS.join("") },
    ]);

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request!.url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(new Headers(request!.init.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    const form = request!.init.body as FormData;
    expect(form.get("model")).toBe("gpt-transcribe");
    expect(form.get("stream")).toBe("true");
    expect(form.getAll("languages[]")).toEqual(["ko", "en"]);
    expect(form.getAll("keywords[]")).toEqual(["git", "server/voice.ts"]);
    expect(form.get("prompt")).toBe("Dictation of a shell command line typed into a terminal");
    expect((form.get("file") as File).name).toBe("audio.webm");
  });

  it("adds the polished text when asked", async () => {
    handler = (url, init) => {
      if (url.endsWith("/audio/transcriptions")) return transcriptAnswer();
      const body = JSON.parse(String(init.body)) as { model: string; reasoning_effort?: string; temperature?: number; messages: Array<{ content: string }> };
      expect(body).toMatchObject({ model: "gpt-6-luna", reasoning_effort: "none" });
      expect(body.temperature).toBeUndefined();
      expect(body.messages.at(-1)!.content).toBe(DELTAS.join(""));
      return Response.json({ choices: [{ message: { content: "안녕하세요. `git status` 실행해 줘." } }] });
    };
    const response = await transcribe(service({ HERDR_WEB_OPENAI_API_KEY: KEY }), clipForm({ polish: "1" }));
    expect((await events(response)).slice(-2)).toEqual([
      { type: "done", text: DELTAS.join("") },
      { type: "polished", text: "안녕하세요. `git status` 실행해 줘." },
    ]);
    expect(requests.map((request) => request.url)).toEqual(["https://api.openai.com/v1/audio/transcriptions", "https://api.openai.com/v1/chat/completions"]);
  });

  it("sends a model without a reasoning setting a fixed temperature instead", async () => {
    let body: Record<string, unknown> = {};
    handler = (url, init) => {
      if (url.endsWith("/audio/transcriptions")) return transcriptAnswer();
      body = JSON.parse(String(init.body)) as Record<string, unknown>;
      return Response.json({ choices: [{ message: { content: "tidy" } }] });
    };
    const voice = service({ HERDR_WEB_OPENAI_API_KEY: KEY });
    voice.update({ polish_model: "gpt-4.1-mini" });
    await events(await transcribe(voice, clipForm({ polish: "1" })));
    expect(body).toMatchObject({ model: "gpt-4.1-mini", temperature: 0 });
    expect("reasoning_effort" in body).toBe(false);
  });

  it("ends after done when polishing fails", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      handler = (url) => url.endsWith("/audio/transcriptions") ? transcriptAnswer() : Response.json({ error: { message: `bad key ${KEY}` } }, { status: 500 });
      const response = await transcribe(service({ HERDR_WEB_OPENAI_API_KEY: KEY }), clipForm({ polish: "1" }));
      const lines = await events(response);
      expect(lines.at(-1)).toEqual({ type: "done", text: DELTAS.join("") });
      expect(lines.some((event) => event.type === "polished" || event.type === "error")).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).not.toContain(KEY);
    } finally {
      warn.mockRestore();
    }
  });

  it("reports a refused key as provider_auth without echoing it", async () => {
    handler = () => Response.json({ error: { message: `Incorrect API key provided: ${KEY}` } }, { status: 401 });
    const response = await transcribe(service({ HERDR_WEB_OPENAI_API_KEY: KEY }), clipForm());
    expect(response.status).toBe(502);
    const body = await response.text();
    expect(JSON.parse(body)).toMatchObject({ error: { code: "provider_auth" } });
    expect(body).not.toContain(KEY);
  });

  it("emits one error line when the provider fails mid-stream", async () => {
    handler = () => sse([{ type: "transcript.text.delta", delta: "안녕" }, { type: "error", error: { message: "server_error" } }], []);
    const response = await transcribe(service({ HERDR_WEB_OPENAI_API_KEY: KEY }), clipForm());
    expect(await events(response)).toEqual([
      { type: "delta", text: "안녕" },
      { type: "error", code: "provider_error", message: "server_error" },
    ]);
  });
});

const modelsOf = (voice: VoiceService, body: unknown) => call(voice, "/api/voice/models", { method: "POST", body: JSON.stringify(body) });

describe("voice models", () => {
  it("lists the ids of a typed server, deduped and sorted, with the typed key", async () => {
    handler = () => Response.json({ data: [{ id: "gemma4-12b" }, { id: "whisper-ptbr" }, { id: "gemma4-12b" }, { id: "Alpha" }, { nope: 1 }] });
    const response = await modelsOf(service(), { base_url: "http://127.0.0.1:4000/v1/", api_key: KEY });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ models: ["Alpha", "gemma4-12b", "whisper-ptbr"] });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe("http://127.0.0.1:4000/v1/models");
    expect(new Headers(requests[0]!.init.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    expect(requests[0]!.init.redirect).toBe("error");
    expect(requests[0]!.init.signal).toBeInstanceOf(AbortSignal);
  });

  it("uses the saved key for the saved server, or when base_url is left out", async () => {
    handler = () => Response.json({ data: [{ id: "a" }] });
    const voice = service();
    await put(voice, { api_key: KEY, base_url: "http://127.0.0.1:4000/v1" });
    expect((await modelsOf(voice, {})).status).toBe(200);
    expect((await modelsOf(voice, { base_url: "http://127.0.0.1:4000/v1/" })).status).toBe(200);
    expect(requests.map((request) => new Headers(request.init.headers).get("authorization"))).toEqual([`Bearer ${KEY}`, `Bearer ${KEY}`]);
  });

  it("never sends the saved key to another base_url", async () => {
    handler = () => Response.json({ data: [] });
    const voice = service();
    await put(voice, { api_key: KEY, base_url: "http://127.0.0.1:4000/v1" });
    for (const base_url of ["http://127.0.0.1:9999/v1", "https://api.openai.com/v1", "http://attacker.invalid/v1"]) {
      const response = await modelsOf(voice, { base_url });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: "invalid_request" } });
    }
    expect(requests).toHaveLength(0);
    // the env key follows the same rule: its server is the env's (or OpenAI's)
    const fromEnv = service({ HERDR_WEB_OPENAI_API_KEY: KEY });
    expect((await modelsOf(fromEnv, { base_url: "http://127.0.0.1:9999/v1" })).status).toBe(400);
    expect(requests).toHaveLength(0);
  });

  it("asks for a key when none is saved or typed", async () => {
    const response = await modelsOf(service(), {});
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "voice_not_configured" } });
  });

  it("maps provider failures to their own codes and scrubs the key", async () => {
    const cases: Array<[() => Response | Promise<Response>, string]> = [
      [() => Response.json({ error: { message: `bad ${KEY}` } }, { status: 401 }), "models_unauthorized"],
      [() => new Response(`forbidden ${KEY}`, { status: 403 }), "models_unauthorized"],
      [() => new Response("nope", { status: 404 }), "models_unsupported"],
      [() => new Response("<html>", { status: 200 }), "models_unsupported"],
      [() => Response.json({ object: "list" }), "models_unsupported"],
      [() => Response.json({ error: KEY }, { status: 502 }), "models_unreachable"],
      [() => { throw new TypeError(`connect failed for ${KEY}`); }, "models_unreachable"],
    ];
    for (const [answer, code] of cases) {
      handler = answer;
      const response = await modelsOf(service(), { api_key: KEY });
      const body = await response.text();
      expect(response.status).toBe(502);
      expect(JSON.parse(body)).toMatchObject({ error: { code } });
      expect(body).not.toContain(KEY);
    }
  });

  it("gives up on a server that does not answer", async () => {
    handler = (_url, init) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(init.signal!.reason));
    });
    const voice = new VoiceService({ stateDir, env: {}, modelsTimeoutMs: 30, async fetch(url, init) { return handler(url, init); } });
    const response = await modelsOf(voice, { api_key: KEY });
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: "models_unreachable" } });
  });

  it("refuses a bad body and a wrong method", async () => {
    expect((await modelsOf(service(), { api_key: "has space" })).status).toBe(400);
    expect((await modelsOf(service(), { api_key: KEY, base_url: "http://example.com/v1" })).status).toBe(400);
    const wrong = await call(service(), "/api/voice/models");
    expect(wrong.status).toBe(405);
    expect(wrong.headers.get("allow")).toBe("POST");
  });
});

describe("voice language and tidy", () => {
  it("sends the chosen language as language and as the only languages[], auto keeps today's", async () => {
    const seen: Array<{ language: unknown; languages: unknown }> = [];
    handler = (_url, init) => { const form = init.body as FormData; seen.push({ language: form.get("language"), languages: form.getAll("languages[]") }); return transcriptAnswer(); };
    const voice = service({ HERDR_WEB_OPENAI_API_KEY: KEY });
    await events(await transcribe(voice, clipForm({ language: "ja" })));
    expect(voice.update({ language: "pt" }).language).toBe("pt");
    await events(await transcribe(voice, clipForm({ language: "ja" })));
    await events(await transcribe(voice, clipForm()));
    expect(voice.update({ language: null }).language).toBeNull();
    await events(await transcribe(voice, clipForm({ language: "ja" })));
    expect(seen).toEqual([
      { language: null, languages: ["ja", "en"] },
      { language: "pt", languages: ["pt"] },
      { language: "pt", languages: ["pt"] },
      { language: null, languages: ["ja", "en"] },
    ]);
    expect(() => voice.update({ language: "portuguese" })).toThrow();
  });

  it("never calls chat/completions when Tidy is off, even if the clip asks for it", async () => {
    handler = (url) => url.endsWith("/audio/transcriptions") ? transcriptAnswer() : Response.json({ choices: [{ message: { content: "tidy" } }] });
    const voice = service({ HERDR_WEB_OPENAI_API_KEY: KEY });
    expect(voice.update({ polish_model: "gemma4-12b", polish_enabled: false })).toMatchObject({ polish_enabled: false, polish_model: "gemma4-12b" });
    const lines = await events(await transcribe(voice, clipForm({ polish: "1" })));
    expect(lines.some((event) => event.type === "polished")).toBe(false);
    expect(requests.map((request) => request.url)).toEqual(["https://api.openai.com/v1/audio/transcriptions"]);
    // a voice.json written before the field existed has Tidy on; true brings it back
    expect(JSON.parse(readFileSync(join(stateDir, "voice.json"), "utf8"))).toMatchObject({ polish_enabled: false });
    expect(voice.update({ polish_enabled: true }).polish_enabled).toBe(true);
    expect("polish_enabled" in JSON.parse(readFileSync(join(stateDir, "voice.json"), "utf8"))).toBe(false);
    await events(await transcribe(voice, clipForm({ polish: "1" })));
    expect(requests.at(-1)!.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(() => voice.update({ polish_enabled: "no" })).toThrow();
  });

  it("allows base_url without the key only when it does not move the key", async () => {
    const voice = service();
    voice.update({ api_key: KEY, base_url: "http://127.0.0.1:4000/v1" });
    expect(voice.update({ base_url: "http://127.0.0.1:4000/v1/" }).base_url).toBe("http://127.0.0.1:4000/v1");
    expect(() => voice.update({ base_url: "http://127.0.0.1:5000/v1" })).toThrow("Send api_key");
    expect(voice.update({ base_url: null, api_key: KEY }).base_url).toBe("https://api.openai.com/v1");
  });
});

describe("voice hardening", () => {
  it("passes redirect: error on the transcription and the chat call", async () => {
    handler = (url) => url.endsWith("/audio/transcriptions") ? transcriptAnswer() : Response.json({ choices: [{ message: { content: "tidy" } }] });
    await events(await transcribe(service({ HERDR_WEB_OPENAI_API_KEY: KEY }), clipForm({ polish: "1" })));
    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.init.redirect)).toEqual(["error", "error"]);
  });

  it("refuses a base_url with credentials, a query, a fragment or plain http to a public host", async () => {
    const voice = service();
    for (const base_url of [
      "https://user:pass@example.com/v1", "https://user@example.com/v1", "https://example.com/v1?key=1", "https://example.com/v1#x",
      "http://example.com/v1", "http://8.8.8.8/v1", "http://172.32.0.1/v1", "http://100.128.0.1/v1", "http://192.169.0.1/v1", "http://localhost.evil.com/v1", "http://local.com/v1", "http://evil-ts.net/v1", "http://[2001:db8::1]/v1", "http://[fe80::1]/v1", "http://[fe00::1]/v1",
    ]) {
      const response = await put(voice, { base_url });
      expect(response.status, base_url).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: "invalid_request" } });
    }
  });

  it("accepts https, loopback, private and tailnet addresses over http", async () => {
    const voice = service();
    for (const base_url of [
      "https://example.com/v1", "http://localhost:4000/v1", "http://127.0.0.1/v1", "http://127.8.8.8/v1", "http://[::1]:4000/v1",
      "http://10.0.25.1/v1", "http://172.16.0.1/v1", "http://dgx/v1", "http://dgx.local/v1", "http://box.lan:4000/v1", "http://a.internal/v1", "http://nas.home.arpa/v1", "http://vm.tail99394e.ts.net/v1", "http://[fd7a:115c:a1e0::1]:4000/v1", "http://[fc00::1]/v1", "http://[fdff::2]/v1", "http://172.31.255.1/v1", "http://192.168.1.2/v1", "http://100.64.0.1/v1", "http://100.114.70.4:4000/v1",
    ]) expect((await put(voice, { base_url })).status, base_url).toBe(200);
  });
});

describe("voice saved settings", () => {
  const KEY2 = "sk-saved-0123456789";
  it("takes a language-only change with an env base_url or a legacy stored one, and pins no model", () => {
    writeFileSync(join(stateDir, "voice.json"), JSON.stringify({ api_key: KEY2, base_url: "http://legacy.example.com/v1" }));
    const legacy = service();
    expect(legacy.status()).toMatchObject({ configured: false });
    rmSync(join(stateDir, "voice.json"));
    writeFileSync(join(stateDir, "voice.json"), JSON.stringify({ api_key: KEY2, base_url: "http://10.1.1.1/v1" }));
    expect(service().update({ language: "pt" })).toMatchObject({ configured: true, language: "pt", base_url: "http://10.1.1.1/v1" });
    const stored = JSON.parse(readFileSync(join(stateDir, "voice.json"), "utf8"));
    expect(stored).toEqual({ api_key: KEY2, base_url: "http://10.1.1.1/v1", language: "pt" });
    // an env base_url (operator-trusted, even plain http to a public host) is not part of such a save
    rmSync(join(stateDir, "voice.json"));
    writeFileSync(join(stateDir, "voice.json"), JSON.stringify({ api_key: KEY2 }));
    const withEnv = service({ HERDR_WEB_OPENAI_BASE_URL: "http://public.example.com/v1" });
    expect(withEnv.update({ language: "pt" })).toMatchObject({ configured: true, base_url: "http://public.example.com/v1", language: "pt" });
    expect(JSON.parse(readFileSync(join(stateDir, "voice.json"), "utf8"))).toEqual({ api_key: KEY2, language: "pt" });
  });

  it("a key-only save leaves the models unset", () => {
    service().update({ api_key: KEY2 });
    expect(JSON.parse(readFileSync(join(stateDir, "voice.json"), "utf8"))).toEqual({ api_key: KEY2 });
  });

  it("does not send the key to a stored base_url the rules now refuse", async () => {
    writeFileSync(join(stateDir, "voice.json"), JSON.stringify({ api_key: KEY2, base_url: "http://public.example.com/v1" }));
    const voice = service();
    const status = voice.status();
    expect(status.configured).toBe(false);
    expect(status.error).toContain("Server URL");
    expect(JSON.stringify(status)).not.toContain(KEY2);
    const response = await transcribe(voice, clipForm());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "voice_not_configured" } });
    const models = await modelsOf(voice, {});
    expect(models.status).toBe(409);
    expect(requests).toHaveLength(0);
    // typing a new URL with the key again repairs it
    expect(voice.update({ api_key: KEY2, base_url: "https://example.com/v1" })).toMatchObject({ configured: true, error: null });
  });
});

describe("voice custom server defaults", () => {
  it("saving a custom server without a Tidy model stores Tidy off and never calls chat/completions", async () => {
    handler = (url) => url.endsWith("/audio/transcriptions") ? transcriptAnswer() : Response.json({ choices: [{ message: { content: "tidy" } }] });
    const voice = service();
    const saved = voice.update({ api_key: KEY, base_url: "http://100.114.70.4:4000/v1" });
    expect(saved).toMatchObject({ polish_enabled: false, base_url: "http://100.114.70.4:4000/v1" });
    const lines = await events(await transcribe(voice, clipForm({ polish: "1" })));
    expect(lines.some((event) => event.type === "polished")).toBe(false);
    expect(requests.map((request) => request.url)).toEqual(["http://100.114.70.4:4000/v1/audio/transcriptions"]);
  });

  it("keeps Tidy on when a Tidy model is saved with the server, and for OpenAI's own", () => {
    const voice = service();
    expect(voice.update({ api_key: KEY, base_url: "http://127.0.0.1:4000/v1", polish_model: "gemma4-12b", polish_enabled: true })).toMatchObject({ polish_enabled: true, polish_model: "gemma4-12b" });
    expect(voice.update({ api_key: KEY, base_url: null, polish_enabled: null }).polish_enabled).toBe(true);
    expect(service().update({ api_key: KEY }).polish_enabled).toBe(true);
  });
});

describe("voice same-server saves and defaults", () => {
  it("a later save on the same server never flips Tidy", () => {
    const voice = service();
    voice.update({ api_key: KEY, base_url: "http://127.0.0.1:4000/v1", polish_model: "gemma4-12b", polish_enabled: true });
    expect(voice.update({ language: "pt" })).toMatchObject({ polish_enabled: true, polish_model: "gemma4-12b" });
    expect(voice.update({ base_url: "http://127.0.0.1:4000/v1/", transcribe_model: "whisper-ptbr" })).toMatchObject({ polish_enabled: true });
  });

  it("Use OpenAI defaults without the key drops the saved key instead of sending it to OpenAI", () => {
    const voice = service();
    voice.update({ api_key: KEY, base_url: "http://127.0.0.1:4000/v1", polish_model: "gemma4-12b", polish_enabled: true, language: "pt" });
    const reset = voice.update({ base_url: null, transcribe_model: null, polish_model: null, polish_enabled: null, language: null });
    expect(reset).toMatchObject({ configured: false, key_stored: false, base_url: "https://api.openai.com/v1", language: null, polish_enabled: true });
    expect(readFileSync(join(stateDir, "voice.json"), "utf8")).not.toContain(KEY);
    expect(requests).toHaveLength(0);
  });
});

describe("voice refused stored URL", () => {
  const refuse = () => writeFileSync(join(stateDir, "voice.json"), JSON.stringify({ api_key: "sk-stored-123456", base_url: "http://public.example.com/v1" }));

  it("reports the key as stored, lets it be removed", () => {
    refuse();
    const voice = service();
    expect(voice.status()).toMatchObject({ configured: false, key_stored: true });
    expect(voice.status().error).not.toBeNull();
    expect(voice.update({ api_key: null })).toMatchObject({ key_stored: false });
  });

  it("moving away without the key drops the key, with it Use OpenAI defaults works", () => {
    refuse();
    const voice = service();
    expect(voice.update({ base_url: null })).toMatchObject({ configured: false, key_stored: false, error: null, base_url: "https://api.openai.com/v1" });
    refuse();
    expect(service().update({ base_url: "https://example.com/v1" })).toMatchObject({ key_stored: false, error: null });
    expect(JSON.parse(readFileSync(join(stateDir, "voice.json"), "utf8"))).not.toHaveProperty("api_key");
  });

  it("typing the key with the URL repairs it", () => {
    refuse();
    expect(service().update({ api_key: KEY, base_url: null })).toMatchObject({ configured: true, error: null });
  });
});

describe("voice models limits", () => {
  it("drops the upstream request when the client's goes", async () => {
    let upstream: AbortSignal | undefined;
    handler = (_url, init) => new Promise<Response>((_resolve, reject) => {
      upstream = init.signal ?? undefined;
      upstream?.addEventListener("abort", () => reject(upstream!.reason));
    });
    const client = new AbortController();
    const pending = service().models({ api_key: KEY }, client.signal).catch((error: Error) => error);
    await Bun.sleep(5);
    expect(upstream?.aborted).toBe(false);
    client.abort();
    expect(upstream?.aborted).toBe(true);
    expect(await pending).toBeInstanceOf(Error);
  });

  it("says a body that stalls is not a bad list", async () => {
    handler = () => new Response(new ReadableStream({ start(controller) { controller.error(new Error("socket hang up")); } }));
    const response = await modelsOf(service(), { api_key: KEY });
    expect(await response.json()).toMatchObject({ error: { code: "models_unreachable" } });
    handler = () => new Response("<html>");
    expect(await (await modelsOf(service(), { api_key: KEY })).json()).toMatchObject({ error: { code: "models_unsupported", message: expect.stringContaining("not JSON") } });
  });

  it("refuses a model list past 1 MB", async () => {
    handler = () => new Response(JSON.stringify({ data: [{ id: "a".repeat(1024 * 1024 + 10) }] }));
    const response = await modelsOf(service(), { api_key: KEY });
    expect(await response.json()).toMatchObject({ error: { code: "models_unsupported" } });
  });

  it("takes the env base_url, spelled differently, with the saved key", async () => {
    writeFileSync(join(stateDir, "voice.json"), JSON.stringify({ api_key: KEY }));
    handler = () => Response.json({ data: [{ id: "m" }] });
    const voice = service({ HERDR_WEB_OPENAI_BASE_URL: "HTTP://Public.Example.com:80/v1/" });
    expect(voice.status().base_url).toBe("http://public.example.com/v1");
    const response = await modelsOf(voice, { base_url: "http://public.example.com/v1" });
    expect(response.status).toBe(200);
    expect(requests[0]!.url).toBe("http://public.example.com/v1/models");
    expect(new Headers(requests[0]!.init.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    // any other public http URL still takes the rules
    expect((await modelsOf(voice, { base_url: "http://other.example.com/v1" })).status).toBe(400);
  });
});
