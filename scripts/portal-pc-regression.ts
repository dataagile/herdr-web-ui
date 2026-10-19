import assert from "node:assert/strict";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import type { Machine } from "../shared/machines.ts";
import { openSettingsPage } from "./settings-page.ts";

// A built client with a fictional roster and an in-memory API standing in for the portal's
// `/api/portal/me`. `pc.add_pc: false` removes every control that ends in a PC setup (the footer,
// the palette, Settings → Remote PCs, Reconnect / setup, Update bridge…, the notices and the
// banner) and nothing else; `pc.name` renames the local PC. Without `pc` the app is unchanged.
const snapshot = { version: "0.9.3", protocol: 22, focused_workspace_id: null, focused_tab_id: null, focused_pane_id: null, workspaces: [], tabs: [], panes: [], layouts: [], agents: [] };
const local = { id: "local", name: "QA host", kind: "local", state: "connected", enabled: true, error: null, snapshot } as Machine;
const remote = { ...local, id: "qa-remote", name: "QA remote", kind: "ssh", target: { destination: "qa.invalid" }, state: "error", error: null, action_required: "setup" } as unknown as Machine;
let remoteAction = "setup";
let meDelay = 0;
let me: unknown = { authenticated: true };
const setups: string[] = [];
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === "/api/portal/me") { if (meDelay) await Bun.sleep(meDelay); return Response.json(me); }
  if (path === "/api/health") return Response.json({ ok: true, auth: { authenticated: true, required: false, role: "drive" }, herdr: { version: "0.9.3", protocol: 22 }, web_ui: { revision: null, boot_id: "qa" } });
  if (path === "/api/machines") return Response.json({ machines: [local, { ...remote, action_required: remoteAction }] });
  if (path === "/api/session") return Response.json({ snapshot });
  if (path === "/api/machines/settings") return Response.json({ auto_update_bridges: false });
  if (path === "/api/machines/qa-remote/update-bridge") return Response.json({ error: { code: "qa", message: "Bridge update refused" } }, { status: 500 });
  if (path === "/api/machines/setup") { setups.push(request.method); return Response.json({ error: { code: "add_pc_disabled", message: "off" } }, { status: 403 }); }
  if (path.startsWith("/api/") || path === "/ws") return Response.json({ error: { code: "qa", message: "Unavailable in fixture" } }, { status: 404 });
  const file = Bun.file(resolve("dist", path === "/" ? "index.html" : path.slice(1)));
  return new Response(await file.exists() ? file : Bun.file("dist/index.html"));
} });
const browser = await chromium.launch({ headless: true, executablePath: process.env["CHROME_PATH"] || chromium.executablePath() });
try {
  const open = async (answer: unknown) => {
    me = answer;
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => localStorage.setItem("herdr-web-ui:settings", JSON.stringify({ language: "en" })));
    await page.goto(server.url.href);
    await page.locator(".machine-action").waitFor({ timeout: 10_000 });
    return page;
  };
  const buttons = async (page: import("playwright-core").Page) => {
    const count = (name: string) => page.getByRole("button", { name, exact: true }).count();
    const result = { footer: await count("Add PC"), notice: await page.locator(".machine-action").getByRole("button", { name: "Set up…", exact: true }).count(), banner: await page.locator(".update-notice").getByRole("button", { name: "Set up…", exact: true }).count() };
    await page.getByRole("button", { name: "Manage QA remote" }).click();
    const manage = { reconnect: await count("Reconnect / setup"), update: await count("Update bridge…"), disconnect: await count("Disconnect"), remove: await count("Remove PC") };
    const dialog = page.getByRole("dialog", { name: "Command palette", exact: true });
    await page.keyboard.press("Control+Shift+k");
    await dialog.waitFor();
    const palette = await dialog.getByRole("option", { name: "Add PC" }).count();
    await dialog.getByRole("option", { name: "Settings" }).click();
    await openSettingsPage(page, "Remote PCs");
    const settings = await page.locator(".settings-dialog").getByRole("button", { name: "Add PC", exact: true }).count();
    await page.keyboard.press("Escape");
    return { ...result, ...manage, palette, settings };
  };

  // without `pc`, or with a `pc` that changes nothing: everything as before
  for (const answer of [{ authenticated: true }, { authenticated: true, pc: null }, { authenticated: true, pc: { name: null, add_pc: true } }]) {
    const page = await open(answer);
    const on = await buttons(page);
    assert.deepEqual(on, { footer: 1, notice: 1, banner: 1, reconnect: 1, update: 1, disconnect: 1, remove: 1, palette: 1, settings: 1 }, JSON.stringify(answer));
    await page.getByText("QA host", { exact: true }).first().waitFor();
    await page.close();
  }

  // add_pc: false hides every setup control and keeps the rest; name renames the local PC
  const page = await open({ authenticated: true, pc: { name: "Notebook da Ana", add_pc: false } });
  const off = await buttons(page);
  assert.deepEqual(off, { footer: 0, notice: 0, banner: 0, reconnect: 0, update: 0, disconnect: 1, remove: 1, palette: 0, settings: 0 });
  await page.getByText("Notebook da Ana", { exact: true }).first().waitFor();
  assert.equal(await page.getByText("QA host", { exact: true }).count(), 0);
  assert.deepEqual(setups, [], "no setup request was made");
  await page.close();

  // the setup controls wait for the portal's answer: a slow /me never lets them flash for add_pc false
  meDelay = 1500;
  for (const addPc of [false, true]) {
    remoteAction = "setup";
    me = { authenticated: true, pc: { name: null, add_pc: addPc } };
    const slow = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await slow.addInitScript(() => localStorage.setItem("herdr-web-ui:settings", JSON.stringify({ language: "en" })));
    await slow.goto(server.url.href);
    await slow.locator(".machine-action").waitFor({ timeout: 10_000 });
    const footer = slow.locator(".sidebar-footer").getByRole("button", { name: "Add PC", exact: true });
    assert.equal(await footer.count(), 0, "no Add PC before /api/portal/me answers");
    if (addPc) await footer.waitFor(); else { await slow.waitForTimeout(2500); assert.equal(await footer.count(), 0, "still off after the answer"); }
    await slow.close();
  }
  meDelay = 0;

  // the other two reasons a PC waits: only the sign-in and the plain reconnect need a setup
  const waiting = async (action: string, addPc: boolean) => {
    remoteAction = action;
    const p = await open({ authenticated: true, pc: { name: null, add_pc: addPc } });
    const count = (scope: string, name: string) => p.locator(scope).getByRole("button", { name, exact: true }).count();
    const seen = { signIn: await count(".machine-action", "Sign in and update…"), noticeUpdate: await count(".machine-action", "Update bridge"), noticeReconnect: await count(".machine-action", "Reconnect"), bannerUpdate: await count(".update-notice", "Update bridge"), bannerReconnect: await count(".update-notice", "Reconnect") };
    return { p, seen };
  };
  let w = await waiting("update_bridge", true);
  assert.deepEqual(w.seen, { signIn: 1, noticeUpdate: 1, noticeReconnect: 0, bannerUpdate: 1, bannerReconnect: 0 });
  await w.p.close();
  w = await waiting("update_bridge", false);
  assert.deepEqual(w.seen, { signIn: 0, noticeUpdate: 1, noticeReconnect: 0, bannerUpdate: 1, bannerReconnect: 0 });
  // a refused one-click update has no setup dialog to fall back to: the banner says why
  await w.p.locator(".update-notice").getByRole("button", { name: "Update bridge", exact: true }).click();
  await w.p.locator(".update-notice .machine-error").getByText("Bridge update refused").waitFor();
  assert.equal(await w.p.getByRole("dialog").count(), 0);
  await w.p.close();
  w = await waiting("bridge_conflict", true);
  assert.deepEqual(w.seen, { signIn: 0, noticeUpdate: 0, noticeReconnect: 1, bannerUpdate: 0, bannerReconnect: 1 });
  await w.p.close();
  w = await waiting("bridge_conflict", false);
  assert.deepEqual(w.seen, { signIn: 0, noticeUpdate: 0, noticeReconnect: 0, bannerUpdate: 0, bannerReconnect: 0 });
  await w.p.close();
  console.log("PASS: add_pc false hides every PC setup control and a portal name renames the local PC; absent or null pc changes nothing");
} finally { await browser.close(); server.stop(true); }
