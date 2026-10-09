/**
 * bun scripts/voice-server-regression.ts   (after `bun run build`)
 * Settings → Voice input → Transcription server against a stand-in OpenAI-compatible server:
 * Test lists the models, the selects preselect, Save persists, a reload shows it, Tidy off
 * disables the tidy switches, and a refused key leaves free-text fields. No real provider.
 * VOICE_SHOTS=<dir> also writes screenshots of the card at 1280 and 390.
 */
import "./test-herdr.ts"; // a herdr session of its own: nothing shows in the user's
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";
import { createServer } from "../server/index.ts";
import { UsageService } from "../server/usage.ts";
import { VoiceService } from "../server/voice.ts";
import { openSettingsPage } from "./settings-page.ts";

const KEY = "sk-fake-provider-key";
const root = realpathSync(mkdtempSync(join(tmpdir(), "herdr-web-ui-voice-browser-")));
const shots = process.env["VOICE_SHOTS"];
if (shots) mkdirSync(shots, { recursive: true });

let modelRequests = 0;
let emptyModels = false;
let slowModels = false;
let textOnly = false;
const provider = Bun.serve({
  hostname: "127.0.0.1", port: 0,
  fetch(request) {
    const { pathname } = new URL(request.url);
    if (request.headers.get("authorization") !== `Bearer ${KEY}`) return Response.json({ error: { message: "bad key" } }, { status: 401 });
    if (pathname === "/v1/models") modelRequests += 1;
    if (pathname === "/v1/models" && slowModels) return new Promise((resolve) => setTimeout(() => resolve(Response.json({ data: [{ id: "late-whisper" }] })), 600));
    if (pathname === "/v1/models" && textOnly) return Response.json({ data: [{ id: "gemma4-12b" }, { id: "gpt-oss-120b" }] });
    if (pathname === "/v1/models" && emptyModels) return Response.json({ data: [] });
    if (pathname === "/v1/models") return Response.json({ data: ["gpt-oss-120b", "gemma4-12b", "whisper-ptbr", "whisper-ptbr-simples"].map((id) => ({ id })) });
    if (pathname === "/v1/audio/transcriptions") return Response.json({ text: "ok" });
    return new Response("not found", { status: 404 });
  },
});
const providerUrl = `http://127.0.0.1:${provider.port}/v1`;
const providerHost = `127.0.0.1:${provider.port}`;
// its own env: nothing from the shell reaches the voice settings
const voice = new VoiceService({ stateDir: join(root, "state"), env: {}, fetch });
const server = createServer({ port: 0, hostname: "127.0.0.1", token: "", stateDir: join(root, "state"), voice, usage: new UsageService(undefined, []) });
const origin = `http://127.0.0.1:${server.port}`;
let browser: Browser | undefined;
const errors: string[] = [];

async function openSettings(page: Page): Promise<void> {
  await page.goto(origin);
  await page.locator(".app").waitFor();
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Control+Shift+Comma");
  await page.getByRole("dialog", { name: "Settings" }).waitFor();
  await openSettingsPage(page, "Voice input");
  await page.getByRole("heading", { name: "Transcription server" }).scrollIntoViewIfNeeded();
}

async function optionTexts(page: Page, label: string): Promise<string[]> {
  return page.getByLabel(label, { exact: true }).locator("option").allTextContents();
}

const savedLine = (tidy: string) => `Saved on this PC: ${providerHost} · whisper-ptbr-simples · tidy ${tidy}`;

try {
  browser = await chromium.launch({ executablePath: process.env["CHROME_PATH"] ?? "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    if (!localStorage.getItem("herdr-web-ui:settings")) localStorage.setItem("herdr-web-ui:settings", JSON.stringify({ language: "en", voiceInput: true }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on("pageerror", (error) => errors.push(error.message));
  await openSettings(page);
  const card = page.locator(".voice-group", { has: page.getByRole("heading", { name: "Transcription server" }) });
  const shot = async (name: string) => { if (shots) await card.screenshot({ path: join(shots, `${name}.png`) }); };

  // a refused key: the error shows, the model fields stay free text
  await page.getByLabel("Server URL", { exact: true }).fill(providerUrl);
  await page.getByLabel("API key", { exact: true }).fill("sk-wrong");
  await page.getByRole("button", { name: "Test and list models" }).click();
  await page.getByRole("alert").filter({ hasText: /refused the key/ }).waitFor();
  assert.equal(await page.getByLabel("Transcription model", { exact: true }).evaluate((el) => el.tagName), "INPUT", "a failed test keeps a text field");
  console.log("PASS a refused key shows the error and leaves free-text model fields");

  // the right key: both fields become selects, whisper first; Tidy stays on None
  await page.getByLabel("API key", { exact: true }).fill(KEY);
  await page.getByRole("button", { name: "Test and list models" }).click();
  await page.getByText("4 models found").waitFor();
  assert.deepEqual(await optionTexts(page, "Transcription model"), ["whisper-ptbr", "whisper-ptbr-simples", "gemma4-12b", "gpt-oss-120b"], "speech-to-text ids first");
  assert.equal(await page.locator("optgroup").first().getAttribute("label"), "Speech-to-text");
  assert.equal(await page.getByLabel("Transcription model", { exact: true }).inputValue(), "whisper-ptbr-simples");
  assert.deepEqual((await optionTexts(page, "Tidy model (optional)")).slice(0, 2), ["None (Tidy off)", "gemma4-12b"]);
  assert.equal(await page.getByLabel("Tidy model (optional)", { exact: true }).inputValue(), "", "Tidy is preselected as None");
  await shot("1280-tested");
  console.log("PASS Test lists the models, preselects whisper-ptbr-simples and leaves Tidy on None");

  // nothing is saved until Save; with Tidy on None it is stored off
  assert.equal(await (await fetch(`${origin}/api/voice`)).json().then((s: { configured: boolean }) => s.configured), false);
  await page.getByLabel("Dictation language", { exact: true }).selectOption("pt");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.locator(".voice-status").getByText(savedLine("off")).waitFor();
  assert.equal(await page.getByLabel("API key", { exact: true }).inputValue(), "", "the key is never kept in the field");
  assert.equal(await page.getByLabel("API key", { exact: true }).getAttribute("placeholder"), "••••");
  assert.equal(JSON.parse(readFileSync(join(root, "state", "voice.json"), "utf8")).polish_enabled, false);
  await page.getByText("Tidy is off: choose a Tidy model in Transcription server").waitFor();
  assert.equal(await page.getByRole("switch", { name: "Tidy dictated text in chat" }).isDisabled(), true);
  assert.equal(await page.getByRole("switch", { name: "Tidy dictated text in the terminal" }).isDisabled(), true);
  await shot("1280-saved");
  console.log("PASS Save with Tidy on None stores Tidy off and disables the tidy switches");

  // pick a Tidy model with the saved key, no key typed: it is kept, and the switches wake up
  await page.getByRole("button", { name: "Test and list models" }).click();
  await page.getByText("4 models found").waitFor();
  assert.equal(await page.getByLabel("Tidy model (optional)", { exact: true }).inputValue(), "", "a saved Tidy off stays on None");
  await page.getByLabel("Tidy model (optional)", { exact: true }).selectOption("gemma4-12b");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.locator(".voice-status").getByText(savedLine("gemma4-12b")).waitFor();
  assert.equal(await page.getByRole("switch", { name: "Tidy dictated text in chat" }).isDisabled(), false);

  // the server holds it: a reload shows it again
  await openSettings(page);
  await page.locator(".voice-status").getByText(savedLine("gemma4-12b")).waitFor();
  assert.equal(await page.getByLabel("Server URL", { exact: true }).inputValue(), providerUrl);
  assert.equal(await page.getByLabel("Dictation language", { exact: true }).inputValue(), "pt");
  const file = JSON.parse(readFileSync(join(root, "state", "voice.json"), "utf8"));
  assert.deepEqual({ base_url: file.base_url, language: file.language, transcribe_model: file.transcribe_model, polish_model: file.polish_model, polish_enabled: file.polish_enabled },
    { base_url: providerUrl, language: "pt", transcribe_model: "whisper-ptbr-simples", polish_model: "gemma4-12b", polish_enabled: undefined });
  await page.getByRole("button", { name: "Test and list models" }).click();
  await page.getByText("4 models found").waitFor();
  assert.equal(await page.getByLabel("Tidy model (optional)", { exact: true }).inputValue(), "gemma4-12b", "a saved Tidy model stays selected");
  console.log("PASS Save persists on the server and the status line survives a reload");

  // Test uses exactly the field: emptied, it is OpenAI's, which the saved key must not reach
  await page.getByLabel("Server URL", { exact: true }).fill("");
  const before = modelRequests;
  await page.getByRole("button", { name: "Test and list models" }).click();
  await page.getByRole("alert").filter({ hasText: /not sent to another server/ }).waitFor();
  assert.equal(modelRequests, before, "the saved key reached no server for an emptied field");
  await page.getByLabel("Server URL", { exact: true }).fill(providerUrl);
  // re-testing keeps what the user picked
  await page.getByRole("button", { name: "Test and list models" }).click();
  await page.getByText("4 models found").waitFor();
  await page.getByLabel("Transcription model", { exact: true }).selectOption("whisper-ptbr");
  await page.getByRole("button", { name: "Test and list models" }).click();
  await page.getByText("4 models found").waitFor();
  assert.equal(await page.getByLabel("Transcription model", { exact: true }).inputValue(), "whisper-ptbr", "a re-test keeps the current choice");
  console.log("PASS Test uses the field's URL only and a re-test keeps the current choice");

  // a key that lists no model: the fields stay text with their values, nothing is cleared
  emptyModels = true;
  await page.getByRole("button", { name: "Test and list models" }).click();
  await page.getByRole("alert").filter({ hasText: "No models available for this key" }).waitFor();
  assert.equal(await page.getByLabel("Transcription model", { exact: true }).evaluate((el) => el.tagName), "INPUT");
  assert.equal(await page.getByLabel("Transcription model", { exact: true }).inputValue(), "whisper-ptbr", "the model is not cleared");
  emptyModels = false;
  console.log("PASS zero models keeps free-text fields with their values");

  // a server with no speech-to-text id: nothing is preselected, the fields stay as they are
  textOnly = true;
  await page.getByRole("button", { name: "Test and list models" }).click();
  await page.getByRole("alert").filter({ hasText: "No speech-to-text model found on this server" }).waitFor();
  assert.equal(await page.getByLabel("Transcription model", { exact: true }).evaluate((el) => el.tagName), "INPUT");
  assert.equal(await page.getByLabel("Transcription model", { exact: true }).inputValue(), "whisper-ptbr");
  textOnly = false;
  console.log("PASS a server without speech-to-text models keeps the fields as text");

  // editing the URL or the key drops the list: free text again, with the current values
  await page.getByRole("button", { name: "Test and list models" }).click();
  await page.getByText("4 models found").waitFor();
  assert.equal(await page.getByLabel("Transcription model", { exact: true }).evaluate((el) => el.tagName), "SELECT");
  await page.getByLabel("API key", { exact: true }).fill("x");
  assert.equal(await page.getByLabel("Transcription model", { exact: true }).evaluate((el) => el.tagName), "INPUT");
  assert.equal(await page.getByLabel("Transcription model", { exact: true }).inputValue(), "whisper-ptbr");
  await page.getByLabel("API key", { exact: true }).fill(KEY);
  console.log("PASS editing the URL or key reverts the model fields to free text");

  // a Test that answers after the fields changed is ignored, and Save waits for a running Test
  slowModels = true;
  await page.getByRole("button", { name: "Test and list models" }).click();
  assert.equal(await page.getByRole("button", { name: "Save", exact: true }).isDisabled(), true, "Save is off while a Test runs");
  await page.getByLabel("API key", { exact: true }).fill("");
  await page.waitForTimeout(900);
  assert.equal(await page.getByLabel("Transcription model", { exact: true }).evaluate((el) => el.tagName), "INPUT", "the late list is ignored");
  assert.equal(await page.getByText(/models found/).count(), 0);
  slowModels = false;
  console.log("PASS a Test that resolves after a field change is ignored");

  // a phone: the card fits and nothing scrolls sideways
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await phone.addInitScript(() => localStorage.setItem("herdr-web-ui:settings", JSON.stringify({ language: "en", voiceInput: true })));
  const small = await phone.newPage();
  small.setDefaultTimeout(10_000);
  small.on("pageerror", (error) => errors.push(error.message));
  await small.goto(origin);
  await small.locator(".app").waitFor();
  await small.waitForLoadState("networkidle");
  await small.keyboard.press("Control+Shift+Comma");
  await small.getByRole("dialog", { name: "Settings" }).waitFor();
  await openSettingsPage(small, "Voice input");
  await small.getByRole("heading", { name: "Transcription server" }).scrollIntoViewIfNeeded();
  await small.getByRole("button", { name: "Test and list models" }).click();
  await small.getByText("4 models found").waitFor();
  const overflow = await small.evaluate(() => ({ page: document.documentElement.scrollWidth - window.innerWidth, dialog: Math.max(0, ...[...document.querySelectorAll(".voice-settings, .voice-settings *")].map((el) => el.getBoundingClientRect().right - window.innerWidth)) }));
  assert.ok(overflow.page <= 0, `no horizontal page scroll at 390 (${overflow.page})`);
  assert.ok(overflow.dialog <= 0, `nothing in Voice input is wider than the phone (${overflow.dialog})`);
  if (shots) await small.locator(".voice-group", { has: small.getByRole("heading", { name: "Transcription server" }) }).screenshot({ path: join(shots, "390-card.png") });
  console.log("PASS the card fits a 390px phone without horizontal scroll");

  // Use OpenAI defaults with a custom server and no typed key: the key is dropped, and the card says so
  await page.getByLabel("API key", { exact: true }).fill("");
  await page.getByRole("button", { name: "Use OpenAI defaults" }).click();
  await page.getByText("The saved key was removed so it is not sent to OpenAI").waitFor();
  await page.locator(".voice-status").getByText("No key saved").waitFor();
  assert.equal(JSON.parse(readFileSync(join(root, "state", "voice.json"), "utf8")).api_key, undefined);
  console.log("PASS Use OpenAI defaults drops the key kept for the custom server and says so");

  assert.deepEqual(errors, [], "no page errors");
} finally {
  await browser?.close().catch(() => {});
  server.stop(true);
  provider.stop(true);
  rmSync(root, { recursive: true, force: true });
}
