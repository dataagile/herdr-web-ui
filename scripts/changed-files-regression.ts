/**
 * Modified files in the header: the button and its count, the panel's two groups, the file viewer's
 * changes tab, the refresh while the panel is open, and the phone's single Chat/Terminal toggle with a
 * header that fits 360 and 390 px. A real herdr pane runs a stand-in "codex" whose rollout holds an
 * apply_patch call; the pane's folder is a temp git repo.
 */
import "./test-herdr.ts";
import assert from "node:assert/strict";
import { Database } from "bun:sqlite";
import { appendFileSync, chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright-core";
import { createServer } from "../server/index.ts";
import { herdrRpc, workspaceClose, workspaceCreate } from "../server/herdr/client.ts";

const root = mkdtempSync(join(tmpdir(), "herdr-web-ui-changed-ui-"));
const repo = join(root, "repo");
const codexHome = join(root, "codex-home");
const thread = "01a0c7a1-56d9-7e20-9f08-f7a2d973bc22";
mkdirSync(repo, { recursive: true });
mkdirSync(join(codexHome, "sessions"), { recursive: true });

const git = (...args: string[]): void => {
  const done = Bun.spawnSync(["git", "-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { stdout: "pipe", stderr: "pipe" });
  if (done.exitCode !== 0) throw new Error(done.stderr.toString());
};
git("init", "-q");
writeFileSync(join(repo, "tracked.txt"), "alpha\nbeta\n");
writeFileSync(join(repo, "other.txt"), "keep\n");
git("add", "."); git("commit", "-q", "-m", "init");
// what the agent's patch did, and a change nobody in the session made
writeFileSync(join(repo, "tracked.txt"), "alpha\nBETA\n");
writeFileSync(join(repo, "made.txt"), "made by the agent\n");
writeFileSync(join(repo, "other.txt"), "kept by someone else\n");

const stamp = (minute: number) => `2026-10-08T10:${String(minute).padStart(2, "0")}:00.000Z`;
const item = (payload: unknown, minute: number) => ({ type: "response_item", timestamp: stamp(minute), payload });
const patchCall = (id: string, patch: string, minute: number) => [
  item({ type: "custom_tool_call", call_id: id, name: "apply_patch", input: patch }, minute),
  item({ type: "custom_tool_call_output", call_id: id, output: "Success" }, minute),
];
const transcript = join(codexHome, "sessions", `rollout-2026-10-08T00-00-00-${thread}.jsonl`);
const rows: unknown[] = [
  { type: "session_meta", payload: { id: thread, cwd: repo } },
  item({ type: "message", role: "user", content: [{ type: "input_text", text: "Fix the files." }] }, 1),
  ...patchCall("p1", `*** Begin Patch\n*** Update File: ${join(repo, "tracked.txt")}\n@@\n alpha\n-beta\n+BETA\n*** Add File: ${join(repo, "made.txt")}\n+made by the agent\n*** End Patch`, 2),
  item({ type: "message", role: "assistant", phase: "final_answer", content: [{ type: "output_text", text: "Done." }] }, 3),
];
writeFileSync(transcript, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
const db = new Database(join(codexHome, "state_5.sqlite"));
db.exec("CREATE TABLE threads (id TEXT, rollout_path TEXT, cwd TEXT, archived INTEGER, agent_role TEXT, created_at INTEGER, updated_at INTEGER, source TEXT, first_user_message TEXT)");
db.query("INSERT INTO threads VALUES (?, ?, ?, 0, NULL, 1, 1, 'cli', ?)").run(thread, transcript, repo, "Fix the files.");
db.close();
const standIn = join(root, "codex");
writeFileSync(standIn, "#!/bin/sh\nsleep 600\n");
chmodSync(standIn, 0o755);

const shots = process.env.UI_EVIDENCE_DIR;
if (shots) mkdirSync(shots, { recursive: true });
const shot = async (page: Page, name: string): Promise<void> => { if (shots) await page.screenshot({ path: join(shots, name) }); };

let workspace: string | undefined;
let server: ReturnType<typeof createServer> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  const created = await workspaceCreate({ cwd: repo, label: "herdr-web-ui-test-changed-ui" });
  workspace = created.workspace.workspace_id;
  const pane = created.root_pane.pane_id;
  await herdrRpc("pane.send_text", { pane_id: pane, text: `${standIn} resume ${thread}\n` });
  for (let attempt = 0; attempt < 100; attempt++) {
    const info = await herdrRpc<{ process_info?: { foreground_processes?: { argv?: string[] }[] } }>("pane.process_info", { pane_id: pane });
    if (info.process_info?.foreground_processes?.some((process) => process.argv?.includes(standIn))) break;
    if (attempt === 99) throw new Error("test Codex process did not start");
    await Bun.sleep(50);
  }
  await herdrRpc("pane.report_agent", { pane_id: pane, source: "manual", agent: "codex", state: "idle", agent_session_path: transcript });
  server = createServer({ port: 0, hostname: "127.0.0.1", token: "", stateDir: join(root, "state"), codexHome });
  const origin = `http://127.0.0.1:${server.port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 800 } });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("herdr-web-ui:settings", JSON.stringify({ language: "en" })));
  page.setDefaultTimeout(15_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // ---- desktop header: the button sits after the Chat/Terminal switch and before the meta, with its count
  await page.goto(`${origin}/?pane=${encodeURIComponent(pane)}`);
  await page.locator(".conn-live").waitFor();
  const button = page.getByRole("button", { name: "Files modified in this session (2)", exact: true });
  await button.waitFor();
  assert.equal((await page.locator(".header-amod-count").textContent())?.trim(), "2");
  const order = await page.evaluate(() => {
    const header = document.querySelector(".app-header")!;
    const index = (selector: string) => [...header.children].findIndex((child) => child.matches(selector) || child.querySelector(selector) !== null);
    return { switch: index(".view-switch"), amod: index(".header-amod"), meta: index(".header-meta"), toggle: index(".view-toggle") };
  });
  assert.ok(order.switch >= 0 && order.switch < order.amod && order.amod < order.meta, `header order ${JSON.stringify(order)}`);
  assert.equal(await page.locator(".view-toggle").isVisible(), false, "no single toggle on a desktop");
  await shot(page, "desktop-header.png");
  console.log("PASS the icon sits after the Chat/Terminal switch with the session's count (2)");

  // ---- the panel: two groups, git's letters
  await button.click();
  const panel = page.getByRole("dialog", { name: "Modified files", exact: true });
  await panel.waitFor();
  const groups = await panel.locator(".changed-heading").allTextContents();
  assert.deepEqual(groups.map((text) => text.replace(/\s+/g, " ").trim()), ["In this session 2", "Other changes in git 1"]);
  const lists = panel.locator(".dir-browser-list");
  assert.equal(await lists.nth(0).locator("li").count(), 2);
  assert.equal(await lists.nth(1).locator("li").count(), 1);
  assert.match(await panel.locator(".changed-note").textContent() ?? "", /may include changes that are not from this agent/i);
  const letters = await panel.locator(".changed-row").evaluateAll((rows) => rows.map((row) => ({
    path: row.querySelector(".changed-path")?.textContent, letter: row.querySelector(".changed-git")?.textContent, add: row.querySelector(".changed-git")?.classList.contains("is-add"),
  })));
  assert.deepEqual(letters.find((row) => row.path === "tracked.txt"), { path: "tracked.txt", letter: "M", add: false });
  assert.deepEqual(letters.find((row) => row.path === "made.txt"), { path: "made.txt", letter: "?", add: true });
  assert.deepEqual(letters.find((row) => row.path === "other.txt"), { path: "other.txt", letter: "M", add: false });
  assert.match(await panel.locator(".changed-row", { hasText: "made.txt" }).textContent() ?? "", /created/);
  assert.match(await panel.locator(".changed-row", { hasText: "tracked.txt" }).textContent() ?? "", /edited ×1/);
  await shot(page, "desktop-panel.png");
  console.log("PASS the panel lists the session's files and, apart, the git-only change");

  // ---- the viewer opens on the changes tab; the File tab is the existing viewer
  await panel.locator(".changed-row", { hasText: "tracked.txt" }).click();
  const viewer = page.getByRole("dialog", { name: "tracked.txt", exact: true });
  await viewer.waitFor();
  const changesTab = viewer.getByRole("button", { name: "Changes in this session", exact: true });
  assert.equal(await changesTab.getAttribute("aria-pressed"), "true");
  await viewer.getByText("Edit 1 of 1", { exact: false }).waitFor();
  assert.match(await viewer.locator(".chat-diff-add").first().textContent() ?? "", /BETA/);
  assert.match(await viewer.locator(".chat-diff-del").first().textContent() ?? "", /beta/);
  assert.match(await viewer.locator(".changed-tabs-note").textContent() ?? "", /1 edit · last /);
  await shot(page, "desktop-viewer-changes.png");
  await viewer.getByRole("button", { name: "File", exact: true }).click();
  await viewer.getByText("alpha", { exact: false }).waitFor();
  assert.equal(await viewer.locator(".chat-diff").count(), 0);
  await viewer.getByRole("button", { name: "Changes in this session", exact: true }).click();
  await viewer.locator(".chat-diff").waitFor();
  await viewer.getByRole("button", { name: "Close file", exact: true }).click();
  await viewer.waitFor({ state: "hidden" });
  console.log("PASS the file opens on 'Changes in this session' and the File tab shows the file");

  // ---- a git-only file shows git's diff
  await panel.locator(".changed-row", { hasText: "other.txt" }).click();
  const other = page.getByRole("dialog", { name: "other.txt", exact: true });
  await other.getByRole("button", { name: "Changes in git", exact: true }).waitFor();
  await other.getByText("+kept by someone else", { exact: false }).waitFor();
  await other.getByRole("button", { name: "Close file", exact: true }).click();
  await other.waitFor({ state: "hidden" });
  console.log("PASS a git-only file shows git's diff");

  // ---- the open panel refreshes on its own: the agent edits again, no click
  appendFileSync(transcript, [
    ...patchCall("p2", `*** Begin Patch\n*** Update File: ${join(repo, "tracked.txt")}\n@@\n alpha\n-BETA\n+Beta\n*** End Patch`, 4),
    item({ type: "message", role: "assistant", phase: "final_answer", content: [{ type: "output_text", text: "Again." }] }, 5),
  ].map((row) => JSON.stringify(row)).join("\n") + "\n");
  await panel.locator(".changed-row", { hasText: "tracked.txt" }).getByText("edited ×2", { exact: true }).waitFor({ timeout: 25_000 });
  console.log("PASS the open panel picked up the agent's next edit within its 15 s refresh");
  await page.keyboard.press("Escape");
  await panel.waitFor({ state: "hidden" });

  // ---- phone widths: one Chat/Terminal button, every control at touch size, no horizontal overflow
  for (const width of [360, 390]) {
    const phone = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    const small = await phone.newPage();
    await small.addInitScript(() => localStorage.setItem("herdr-web-ui:settings", JSON.stringify({ language: "en" })));
    small.setDefaultTimeout(15_000);
    small.on("pageerror", (error) => errors.push(error.message));
    await small.goto(`${origin}/?pane=${encodeURIComponent(pane)}`);
    await small.locator(".conn-live").waitFor();
    await small.locator(".header-amod").waitFor();
    assert.equal(await small.locator(".view-switch").isVisible(), false, "the two-option switch is hidden on a phone");
    const toggle = small.locator(".view-toggle");
    assert.equal(await toggle.isVisible(), true);
    const first = await toggle.getAttribute("aria-label");
    await toggle.click();
    await small.waitForFunction((was) => document.querySelector(".view-toggle")?.getAttribute("aria-label") !== was, first);
    const second = await toggle.getAttribute("aria-label");
    assert.deepEqual([first, second].sort(), ["Switch to Chat", "Switch to Terminal"]);
    // the pane really changed lens
    assert.equal(await small.locator(".chat-view").count() > 0, second === "Switch to Terminal");
    await toggle.click();
    await small.waitForFunction((was) => document.querySelector(".view-toggle")?.getAttribute("aria-label") !== was, second);
    const measured = await small.evaluate(() => {
      const header = document.querySelector<HTMLElement>(".app-header")!;
      const target = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--touch-target"));
      const controls = [...header.querySelectorAll<HTMLElement>("button, a")].filter((el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0)
        .map((el) => { const box = el.getBoundingClientRect(); return { name: el.getAttribute("aria-label") ?? el.className, left: Math.round(box.left), right: Math.round(box.right), width: Math.round(box.width), height: Math.round(box.height) }; });
      return {
        target, controls, innerWidth: window.innerWidth, pageScroll: document.documentElement.scrollWidth,
        headerScroll: header.scrollWidth, headerClient: header.clientWidth,
      };
    });
    console.log(`phone ${width}: touch-target ${measured.target}px; page scrollWidth ${measured.pageScroll}/${measured.innerWidth}; header scrollWidth ${measured.headerScroll}/${measured.headerClient}`);
    console.log("  " + measured.controls.map((c) => `${c.name}[${c.left}-${c.right} ${c.width}x${c.height}]`).join(" "));
    assert.ok(measured.pageScroll <= measured.innerWidth, `page overflows at ${width}`);
    assert.ok(measured.headerScroll <= measured.headerClient, `header overflows at ${width}`);
    for (const control of measured.controls) {
      assert.ok(control.right <= measured.innerWidth && control.left >= 0, `${control.name} leaves the screen at ${width}`);
      assert.ok(control.width >= measured.target - 1 && control.height >= measured.target - 1, `${control.name} is under the touch size at ${width}: ${control.width}x${control.height}`);
    }
    const names = measured.controls.map((c) => c.name);
    assert.ok(names.some((n) => n.startsWith("Files modified in this session")), "the button is in the bar");
    await shot(small, `phone-header-${width}.png`);
    if (width === 390) {
      await small.locator(".header-amod button").click();
      const sheet = small.getByRole("dialog", { name: "Modified files", exact: true });
      await sheet.waitFor();
      const box = await sheet.boundingBox();
      assert.ok(box !== null && box.width <= 390 && box.y > 0, "the panel is a bottom sheet");
      await shot(small, "phone-sheet.png");
    }
    await phone.close();
    console.log(`PASS phone ${width}: single toggle, ${measured.controls.length} header controls at touch size, no horizontal overflow`);
  }

  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  server?.stop();
  if (workspace) await workspaceClose(workspace).catch(() => undefined);
  rmSync(root, { recursive: true, force: true });
}
