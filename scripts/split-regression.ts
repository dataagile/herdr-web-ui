/**
 * A tab with several panes in a real browser, against an owned herdr (scripts/test-herdr.ts, never
 * the user's): its panes side by side at 1366px, a click that focuses, a divider drag that herdr
 * answers, zoom that frees the Chat, a closed pane, the phone's one pane and picker, the sidebar's
 * version line — and, above all, that drawing the split view resizes no pane's pty. Run after
 * `bun run build`. UI_EVIDENCE_DIR collects the screenshots.
 */
import "./test-herdr.ts";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { createServer } from "../server/index.ts";
import { herdrRpc, paneRead, paneSendKeys, paneSendText, sessionSnapshot, workspaceClose, workspaceCreate } from "../server/herdr/client.ts";
import type { PaneLayoutSnapshot } from "../shared/protocol.ts";

type Frame = { dir: "in" | "out"; type: string; keep_size?: boolean };

async function until(check: () => boolean | Promise<boolean>, label: string): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await Bun.sleep(50);
  }
}

/** The size the pane's own shell reports (`stty size`): the pty's, not what a browser thinks. */
function shellSize(paneId: string): () => Promise<string> {
  let asked = 0;
  return async () => {
    const marker = `size-${paneId.replace(/\W/g, "")}-${++asked}`;
    await paneSendText(paneId, `echo ${marker} $(stty size)`);
    await paneSendKeys(paneId, ["Enter"]);
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const text = (await paneRead({ paneId, source: "recent", lines: 80, stripAnsi: true })).text;
      const found = [...text.matchAll(new RegExp(`^${marker} (\\d+ \\d+)\\s*$`, "gm"))].at(-1);
      if (found) return found[1]!;
      await Bun.sleep(100);
    }
    throw new Error(`no ${marker} answer from the pane`);
  };
}

const layoutOf = async (tabId: string): Promise<PaneLayoutSnapshot> => {
  const layout = (await sessionSnapshot()).layouts.find((entry) => entry.tab_id === tabId);
  assert.ok(layout, `herdr has a layout for ${tabId}`);
  return layout;
};

/** A page on the pane that records the frames its socket sends and receives (`frames_`). */
async function open(browser: Browser, contexts: BrowserContext[], origin: string, paneId: string, options: Parameters<Browser["newContext"]>[0]): Promise<Page> {
  const context = await browser.newContext({ locale: "en-US", ...options });
  contexts.push(context);
  await context.addInitScript(() => {
    localStorage.setItem("herdr-web-ui:settings", JSON.stringify({ language: "en", defaultView: "terminal" }));
    const frames: Frame[] = [];
    (window as unknown as { frames_: Frame[] }).frames_ = frames;
    const Native = window.WebSocket;
    class Recording extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        this.addEventListener("message", (event) => { try { frames.push({ dir: "in", type: JSON.parse(String(event.data)).type }); } catch { /* binary */ } });
      }
      override send(data: string): void { try { const frame = JSON.parse(data); frames.push({ dir: "out", type: frame.type, keep_size: frame.keep_size }); } catch { /* not JSON */ } super.send(data); }
    }
    Object.assign(window, { WebSocket: Recording });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  await page.goto(`${origin}/?pane=${encodeURIComponent(paneId)}`);
  await page.locator(".conn-live").waitFor({ state: "attached" });
  return page;
}

const frames = (page: Page): Promise<Frame[]> => page.evaluate(() => (window as unknown as { frames_: Frame[] }).frames_.slice());
const inputReady = (page: Page, count: number) => page.waitForFunction((n) => (window as unknown as { frames_: Frame[] }).frames_.filter((f) => f.dir === "in" && f.type === "input-ready").length >= n, count, { timeout: 15_000 });

/** A pane cell's box on the page. */
async function box(page: Page, paneId: string) {
  const found = await page.locator(`[data-split-pane="${paneId}"]`).boundingBox();
  assert.ok(found, `${paneId} is drawn`);
  return found;
}

const shot = async (page: Page, name: string): Promise<void> => {
  const dir = process.env.UI_EVIDENCE_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
};

const root = realpathSync(mkdtempSync(join(tmpdir(), "herdr-web-ui-split-")));
const workspaces: string[] = [];
const contexts: BrowserContext[] = [];
const errors: string[] = [];
let server: ReturnType<typeof createServer> | undefined;
let browser: Browser | undefined;
let holder: WebSocket | undefined;

try {
  // a tab of two panes, made in herdr and not attached by anyone yet: the left one an agent, the right a shell
  const created = await workspaceCreate({ cwd: root, label: "herdr-web-ui-test-split-view" });
  workspaces.push(created.workspace.workspace_id);
  const tabId = created.root_pane.tab_id;
  const left = created.root_pane.pane_id;
  await herdrRpc("pane.report_agent", { pane_id: left, source: "manual", agent: "claude", state: "idle" });
  const right = (await herdrRpc<{ pane: { pane_id: string } }>("pane.split", { target_pane_id: left, direction: "right", focus: false })).pane.pane_id;
  const sizeLeft = shellSize(left);
  const sizeRight = shellSize(right);

  server = createServer({ port: 0, hostname: "127.0.0.1", token: "", stateDir: join(root, "state") });
  const origin = `http://127.0.0.1:${server.port}`;
  // Another device already drives both ptys, at a size that is neither herdr's rectangle nor the
  // browser's box (herdr's own TUI would be such a client): drawing the split view must leave it.
  holder = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
  const held: string[] = [];
  holder.addEventListener("message", (event) => { try { const frame = JSON.parse(String(event.data)); if (frame.type === "input-ready") held.push(frame.pane_id); } catch { /* output */ } });
  const socket = holder;
  await new Promise<void>((resolve, reject) => { socket.addEventListener("open", () => resolve(), { once: true }); socket.addEventListener("error", reject, { once: true }); });
  for (const id of [left, right]) socket.send(JSON.stringify({ type: "attach", pane_id: id, cols: 100, rows: 30 }));
  await until(() => held.includes(left) && held.includes(right), "the other device attaches both panes");
  const before = { left: await sizeLeft(), right: await sizeRight() };
  assert.deepEqual(before, { left: "30 100", right: "30 100" }, "the other device set the ptys to 100x30");
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox", "--accept-lang=en-US"] });

  // ---- S1: both panes side by side at 1366px, laid out as herdr has them ----
  const page = await open(browser, contexts, origin, left, { viewport: { width: 1366, height: 800 } });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.locator(".split-pane").nth(1).waitFor();
  assert.equal(await page.locator(".split-pane").count(), 2, "a tab of two panes draws both");
  await inputReady(page, 2);
  const a = await box(page, left);
  const b = await box(page, right);
  assert.ok(a.x + a.width <= b.x + 1, `the second pane is beside the first (${a.x}+${a.width} <= ${b.x})`);
  assert.ok(Math.abs(a.y - b.y) <= 1 && Math.abs(a.height - b.height) <= 1, "side by side: the same top and height");
  const layout = await layoutOf(tabId);
  const share = layout.splits[0]!.ratio;
  assert.ok(Math.abs(a.width / (a.width + b.width) - share) < 0.03, `the proportions are herdr's (${a.width}:${b.width} for ratio ${share})`);
  assert.equal(await page.locator(".split-pane.is-focused").getAttribute("data-split-pane"), left, "the pane the page opened on holds the amber edge");
  for (const id of [left, right]) assert.equal(await page.locator(`[data-split-pane="${id}"] .xterm`).count(), 1, `${id} has its own terminal`);
  // the header: agent name, pane label and the three buttons
  const head = page.locator(`[data-split-pane="${left}"] .split-pane-head`);
  assert.match(await head.innerText(), /Claude/, "the header names the agent");
  for (const name of ["Split", "Zoom", "Close pane"]) assert.equal(await head.getByRole("button", { name, exact: true }).count(), 1, `the header has ${name}`);
  console.log(`PASS two panes side by side at 1366px in herdr's proportions (${Math.round(a.width)}:${Math.round(b.width)})`);
  await shot(page, "split-2-panes");

  // ---- S7: drawing the split view resized no pty, and each xterm has the grid herdr gave its pane ----
  const sent = (await frames(page)).filter((f) => f.dir === "out");
  assert.deepEqual(sent.filter((f) => f.type === "resize"), [], "the split view sent no resize");
  assert.ok(sent.filter((f) => f.type === "attach").length >= 2 && sent.filter((f) => f.type === "attach").every((f) => f.keep_size === true), "every attach of the split view leaves the pty's size alone");
  assert.deepEqual({ left: await sizeLeft(), right: await sizeRight() }, before, "the panes' ptys are the size they were before the page drew them");
  const [rowsLeft, colsLeft] = before.left.split(" ").map(Number) as [number, number];
  const rowsDrawn = () => page.locator(`[data-split-pane="${left}"] .xterm-rows > div`).count();
  await until(async () => await rowsDrawn() === rowsLeft, "the left terminal draws the pty's rows, not its box's");
  console.log(`PASS rendering the split view leaves the ptys at ${before.left} / ${before.right} (no resize frame, every attach keeps the size; each terminal draws the pty's ${rowsLeft} rows x ${colsLeft} columns, its font scaled to the box)`);

  // ---- S1: a click focuses, here and in herdr; typing goes to the focused pane only ----
  await page.locator(`[data-split-pane="${right}"] .split-pane-body`).click();
  await page.locator(`[data-split-pane="${right}"].is-focused`).waitFor();
  await until(async () => (await layoutOf(tabId)).focused_pane_id === right, "herdr focuses the clicked pane");
  await page.keyboard.type("echo typed-in-the-right-one");
  await page.keyboard.press("Enter");
  await until(async () => (await paneRead({ paneId: right, source: "recent", lines: 40, stripAnsi: true })).text.includes("typed-in-the-right-one"), "the focused pane gets the keys");
  assert.ok(!(await paneRead({ paneId: left, source: "recent", lines: 40, stripAnsi: true })).text.includes("typed-in-the-right-one"), "the other pane gets none");
  console.log("PASS a click focuses a pane in the page and in herdr; the keyboard goes to it only");

  // ---- S5: with several panes visible the Chat is off, and says how to turn it on ----
  const chat = page.locator(".view-switch button").first();
  assert.equal(await chat.isDisabled(), true, "Chat is disabled while two panes are visible");
  assert.equal(await chat.getAttribute("title"), "Chat: zoom (⤢) a pane");
  assert.equal(await page.locator(".terminal-stack.is-chat").count(), 0, "no pane shows a chat");
  console.log("PASS Chat is disabled with several panes visible, its tooltip says to zoom a pane");

  // ---- S3: dragging the divider resizes the layout through herdr ----
  const divider = page.locator(".split-divider");
  assert.equal(await divider.count(), 1, "one divider between two panes");
  const grip = await divider.boundingBox();
  assert.ok(grip);
  const startX = grip.x + grip.width / 2;
  const y = grip.y + grip.height / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + 80, y, { steps: 6 });
  await page.mouse.move(startX + 160, y, { steps: 6 });
  // live preview: the panes follow the pointer before herdr has answered
  const live = await box(page, left);
  assert.ok(live.width > a.width + 100, `the preview follows the pointer (${a.width} -> ${live.width})`);
  await shot(page, "split-dragging");
  await page.mouse.up();
  await until(async () => (await layoutOf(tabId)).splits[0]!.ratio > share + 0.08, "herdr's layout carries the drag");
  const dragged = (await layoutOf(tabId)).splits[0]!.ratio;
  await until(async () => { const now = await box(page, left); const other = await box(page, right); return Math.abs(now.width / (now.width + other.width) - dragged) < 0.03; }, "the panes settle on herdr's answer");
  // a drag past the end keeps the minimum: a pane cannot collapse
  const grip2 = (await divider.boundingBox())!;
  await page.mouse.move(grip2.x + grip2.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(1366, y, { steps: 8 });
  await page.mouse.up();
  await until(async () => (await layoutOf(tabId)).splits[0]!.ratio > dragged, "the second drag lands");
  const squeezed = await box(page, right);
  assert.ok(squeezed.width >= 60, `the squeezed pane keeps its room (${squeezed.width}px)`);
  assert.ok((await layoutOf(tabId)).panes.every((pane) => pane.rect.width >= 10), "herdr's panes are at least ten columns wide");
  console.log(`PASS dragging the divider moves herdr's ratio ${share} -> ${dragged}; a drag to the edge keeps a pane's minimum (${Math.round(squeezed.width)}px)`);

  // ---- S2: Split from the header, with a shell, beside the pane that was in front; three panes ----
  await page.locator(`[data-split-pane="${left}"]`).click({ position: { x: 20, y: 40 } });
  await page.locator(".header-split").click();
  await page.getByRole("menuitem", { name: "Split down", exact: true }).click();
  await page.locator(".split-pane").nth(2).waitFor();
  assert.equal(await page.locator(".split-pane").count(), 3, "Split down adds a third pane");
  const three = await layoutOf(tabId);
  assert.equal(three.panes.length, 3);
  const made = three.panes.find((pane) => ![left, right].includes(pane.pane_id))!;
  await page.locator(`[data-split-pane="${made.pane_id}"].is-focused`).waitFor();
  assert.equal(await page.locator(".header-split").count(), 1, "New tab stays beside Split");
  assert.equal(await page.locator(".app-header").getByRole("button", { name: /New tab/ }).count(), 1);
  await page.waitForTimeout(500);
  await shot(page, "split-3-panes");
  console.log("PASS Split down from the header adds a focused pane beside the one it split");

  // the pane menu: right-click opens it with the agent picker and the zoom
  await page.locator(`[data-split-pane="${made.pane_id}"] .split-pane-body`).click({ button: "right" });
  const menu = page.getByRole("menu");
  await menu.waitFor();
  for (const name of ["Split right", "Split down", "Zoom", "New tab", "Close pane"]) assert.equal(await menu.getByRole("menuitem", { name }).count(), 1, `the pane menu offers ${name}`);
  assert.equal(await menu.getByRole("combobox", { name: "Agent of the new pane" }).inputValue(), "", "a shell is the default");
  assert.ok((await menu.getByRole("combobox", { name: "Agent of the new pane" }).locator("option").count()) >= 2, "the agents are offered");
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "detached" });

  // ---- close one (the shell just made): back to two ----
  await page.locator(`[data-split-pane="${made.pane_id}"]`).getByRole("button", { name: "Close pane", exact: true }).click();
  await until(async () => (await layoutOf(tabId)).panes.length === 2, "herdr closes the pane");
  await until(async () => await page.locator(".split-pane").count() === 2, "the page draws two again");
  console.log("PASS × in a pane header closes that pane");

  // ---- S4: zoom frees the Chat; Esc and Unzoom return to the split ----
  await page.locator(`[data-split-pane="${left}"]`).getByRole("button", { name: "Zoom", exact: true }).click();
  await until(async () => (await layoutOf(tabId)).zoomed, "herdr zooms");
  await page.waitForFunction(() => document.querySelectorAll(".split-pane").length === 0);
  await page.locator(".header-unzoom").waitFor();
  assert.match(await page.locator(".context-sub").innerText(), /zoom 1\/2/, "the header says which pane of how many is zoomed");
  assert.equal(await chat.isDisabled(), false, "Chat is enabled for the zoomed pane");
  assert.equal(await page.locator(".tab-strip-panes-count").first().innerText(), "1/2", "the picker says 1/2 for a single pane in front");
  await chat.click();
  await page.locator(".terminal-stack.is-chat").waitFor();
  await page.waitForTimeout(500);
  await shot(page, "zoom-chat");
  console.log("PASS zoom shows one pane, enables Chat and shows it; the header says zoom 1/2");
  // Escape from the page's chrome leaves the zoom (in the terminal or the message box it is the agent's key)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Escape");
  await until(async () => !(await layoutOf(tabId)).zoomed, "Escape unzooms");
  await page.locator(".split-pane").nth(1).waitFor();
  assert.equal(await chat.isDisabled(), true, "back to the split: Chat is off again");
  assert.equal(await page.locator(".terminal-stack.is-chat").count(), 0, "and the panes show terminals");
  await page.locator(`[data-split-pane="${right}"]`).getByRole("button", { name: "Zoom", exact: true }).click();
  await page.locator(".header-unzoom").click();
  await until(async () => !(await layoutOf(tabId)).zoomed, "Unzoom unzooms");
  await page.locator(".split-pane").nth(1).waitFor();
  console.log("PASS Escape and Unzoom return to the split, in the terminal");

  // ---- V1/V2: the footer says what this is ----
  const version = page.locator(".sidebar-version");
  const line = await version.innerText();
  assert.match(line, /^Data Agile Dev · v\d+\.\d+\.\d+ · [0-9a-f]{7,}$|^Data Agile Dev · v\d+\.\d+\.\d+ · dev$/, `the footer reads brand, version and commit (${line})`);
  assert.deepEqual(line.split(" · ").length, 3);
  assert.match((await version.getAttribute("title")) ?? "", /^herdr \d+\.\d+\.\d+ · build .+/, "the tooltip says the herdr version and the build");
  await version.scrollIntoViewIfNeeded();
  await page.locator(".sidebar-footer").screenshot({ path: process.env.UI_EVIDENCE_DIR ? join(process.env.UI_EVIDENCE_DIR, "footer.png") : "/dev/null" }).catch(() => undefined);
  console.log(`PASS the sidebar footer reads "${line}"`);

  // ---- S6: a phone shows one pane at a time with the picker; Split still works and shows the new pane ----
  const phone = await open(browser, contexts, origin, left, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  phone.on("pageerror", (error) => errors.push(error.message));
  await phone.locator(".terminal-stack").waitFor();
  await phone.locator(".tab-strip").waitFor();
  assert.equal(await phone.locator(".split-pane").count(), 0, "a phone draws no side-by-side panes");
  assert.equal(await phone.locator(".terminal-stack").count(), 1, "a phone draws one pane");
  assert.equal(await phone.locator(".tab-strip-panes-count").first().innerText(), "1/2", "the tab's picker says 1/2");
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "nothing overflows sideways");
  const title = await phone.locator(".context-title-text").boundingBox();
  assert.ok(title && title.width >= 40, "the header keeps room for the pane's title");
  await shot(phone, "phone-390");
  // at phone width Split is the More menu's, which leaves the pane's title its room
  assert.equal(await phone.locator(".header-split").isVisible(), false, "the header's own Split button gives its room to the title");
  await phone.locator(".header-more-button").tap();
  await phone.getByRole("button", { name: "Split", exact: true }).tap();
  await phone.getByRole("button", { name: "Split right" }).tap();
  await until(async () => (await layoutOf(tabId)).panes.length === 3, "herdr splits from the phone");
  await phone.waitForFunction(() => document.querySelector(".tab-strip-panes-count")?.textContent === "3/3" || /\d\/3/.test(document.querySelector(".tab-strip-panes-count")?.textContent ?? ""));
  assert.equal(await phone.locator(".split-pane").count(), 0, "and still one pane at a time");
  console.log("PASS a phone shows one pane with the 1/N picker; Split from it adds a pane and shows it");
  await phone.getByRole("button", { name: "Open workspace list" }).tap();
  const drawerLine = await phone.locator(".sidebar-version").innerText();
  assert.equal(drawerLine, line, "the phone's drawer carries the same version line");
  console.log("PASS the phone's drawer carries the version line too");

  assert.deepEqual(errors, [], "no page errors");
} finally {
  for (const context of contexts) await context.close().catch(() => undefined);
  holder?.close();
  await browser?.close().catch(() => undefined);
  server?.stop();
  for (const id of workspaces) await workspaceClose(id).catch(() => undefined);
  rmSync(root, { recursive: true, force: true });
}
