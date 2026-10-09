/**
 * The Files dialog's tree, its filter, and the viewer's drawn formats, on a real herdr pane whose
 * folder is a temp tree: folders open and close, the keys of a tree, open folders remembered, the
 * server's 500-entry cut, the filter (a folder the tree never opened, folded chain, empty state,
 * Esc twice), markdown drawn (hostile markup stays text) with Edit only under Code, html in an
 * empty sandbox where its script does not run, and a 390 px phone without horizontal overflow.
 */
import "./test-herdr.ts";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright-core";
import { createServer } from "../server/index.ts";
import { workspaceClose, workspaceCreate } from "../server/herdr/client.ts";

const root = realpathSync(mkdtempSync(join(tmpdir(), "herdr-web-ui-files-tree-")));
const put = (path: string, text: string): void => { mkdirSync(join(root, path, ".."), { recursive: true }); writeFileSync(join(root, path), text); };
put("README.md", [
  "# Project title", "",
  "Intro with a [site](https://example.com/) and a [bad](javascript:window.__pwned=1) link.", "",
  "<script>window.__pwned = 1</script>", "",
  "<img src=x onerror=\"window.__pwned = 1\">", "",
  "- first item", "- second item", "",
  "```bash", "npm install", "```",
].join("\n"));
put("page.html", "<!doctype html><html><body><h1>Report</h1><img src=\"https://example.com/x.png\"><link rel=\"stylesheet\" href=\"https://example.com/s.css\"><p id=\"x\">script off</p><script>document.getElementById('x').textContent = 'SCRIPT RAN'; window.parent.__pwned = 1;</script></body></html>");
put("docs/a.md", "# A\n");
put("docs/b.txt", "bee\n");
put("src/lib/deep/inner/target-note.txt", "needle\n");
for (let n = 0; n < 520; n++) put(`big/f${String(n).padStart(3, "0")}.txt`, "");

const shots = process.env.UI_EVIDENCE_DIR;
if (shots) mkdirSync(shots, { recursive: true });
const shot = async (page: Page, name: string): Promise<void> => { if (shots) await page.screenshot({ path: join(shots, name) }); };

let workspace: string | undefined;
let server: ReturnType<typeof createServer> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  const created = await workspaceCreate({ cwd: root, label: "herdr-web-ui-test-files-tree" });
  workspace = created.workspace.workspace_id;
  const pane = created.root_pane.pane_id;
  server = createServer({ port: 0, hostname: "127.0.0.1", token: "", stateDir: join(root, ".state") });
  const origin = `http://127.0.0.1:${server.port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/google/chrome/chrome", headless: true,
    // a sandboxed frame is its own process by default, and Playwright does not see its requests: keep it in the page's so the "nothing was fetched" check can
    args: ["--no-sandbox", "--disable-features=IsolateSandboxedIframes"] });
  const errors: string[] = [];
  const open = async (phone: boolean): Promise<Page> => {
    const context = await browser!.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    // (it also runs in the sandboxed html frame, which has no storage to touch)
    await page.addInitScript(() => { try { localStorage.setItem("herdr-web-ui:settings", JSON.stringify({ language: "en" })); } catch {} });
    page.setDefaultTimeout(15_000);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/?pane=${encodeURIComponent(pane)}`);
    await page.locator(".conn-live").waitFor();
    return page;
  };
  const openFiles = async (page: Page) => {
    await page.locator(".app-header .header-files").click();
    const dialog = page.getByRole("dialog", { name: "Files", exact: true });
    await dialog.getByRole("tree").waitFor();
    await dialog.getByRole("treeitem").first().waitFor();
    return dialog;
  };
  const names = (page: Page) => page.getByRole("dialog", { name: "Files", exact: true }).locator(".tree-row .tree-name").allTextContents();
  const focused = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.path?.replace(/^.*\/herdr-web-ui-files-tree-[^/]+/, "") ?? null);

  const page = await open(false);
  const remote: string[] = [];
  await page.route(/\/\/example\.com\//, (route) => { remote.push(route.request().url()); return route.abort(); });
  let dialog = await openFiles(page);
  const row = (name: string) => dialog.locator(".tree-row", { has: page.locator(".tree-name", { hasText: new RegExp(`^${name.replace(".", "\\.")}$`) }) });

  // ---- the tree: folders first, closed, with tree semantics
  assert.deepEqual(await names(page), ["big", "docs", "src", "page.html", "README.md"]);
  const levels = await dialog.getByRole("treeitem").evaluateAll((items) => items.map((item) => [item.getAttribute("aria-level"), item.getAttribute("aria-expanded"), item.getAttribute("aria-posinset"), item.getAttribute("aria-setsize")]));
  assert.deepEqual(levels, [["1", "false", "1", "5"], ["1", "false", "2", "5"], ["1", "false", "3", "5"], ["1", null, "4", "5"], ["1", null, "5", "5"]]);
  assert.equal(await dialog.locator('.tree-row[tabindex="0"]').count(), 1, "one tabbable row (roving tabindex)");
  console.log("PASS the tree lists folders before files, closed, with treeitem levels and one tabbable row");

  // ---- expand and collapse by click
  await row("docs").click();
  await row("a.md").waitFor();
  assert.equal(await row("docs").getAttribute("aria-expanded"), "true");
  assert.equal(await row("a.md").getAttribute("aria-level"), "2");
  assert.equal(await row("a.md").locator(".tree-guides i").count(), 1, "one indent guide at level 2");
  await row("docs").click();
  await row("a.md").waitFor({ state: "detached" });
  console.log("PASS a folder opens in place, one level deeper with its guide, and closes again");

  // ---- the keys of a tree
  await row("docs").click();
  await row("a.md").waitFor();
  // the focusable element is the treeitem itself; its children sit in a group
  const itemOf = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    return { role: el.getAttribute("role"), level: el.getAttribute("aria-level"), expanded: el.getAttribute("aria-expanded"), selected: el.getAttribute("aria-selected"), pos: el.getAttribute("aria-posinset"), size: el.getAttribute("aria-setsize"), tab: el.tabIndex, name: el.querySelector(".tree-name")?.textContent };
  });
  assert.deepEqual(itemOf, { role: "treeitem", level: "1", expanded: "true", selected: "false", pos: "2", size: "5", tab: 0, name: "docs" });
  assert.equal(await dialog.locator('[role="group"].tree-group > li > [role="treeitem"][aria-level="2"][aria-posinset="1"][aria-setsize="2"]').count(), 1, "a.md is the first of two items in docs group");
  assert.equal(await dialog.locator("button[role=treeitem], li[role=treeitem]").count(), 0);
  await page.keyboard.press("ArrowDown");
  assert.equal(await focused(page), "/docs/a.md", "Down moves to the next row");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await focused(page), "/docs", "Left on a file goes to its folder");
  await page.keyboard.press("ArrowLeft");
  await row("a.md").waitFor({ state: "detached" });
  await page.keyboard.press("ArrowRight");
  await row("a.md").waitFor();
  await page.keyboard.press("ArrowRight");
  assert.equal(await focused(page), "/docs/a.md", "Right on an open folder steps into it");
  await page.keyboard.press("Home");
  assert.equal(await focused(page), "/big");
  await page.keyboard.press("End");
  assert.equal(await focused(page), "/README.md");
  await shot(page, "tree.png");
  console.log("PASS Up/Down, Left/Right (collapse, parent, expand, enter child), Home and End move through the tree");

  // ---- the 500-entry cut says so
  await row("big").click();
  await dialog.getByText("More items than shown — refine the filter").waitFor();
  assert.equal(await dialog.locator(".tree-row.is-file").evaluateAll((rows) => rows.filter((r) => /^f\d+\.txt$/.test(r.querySelector(".tree-name")?.textContent ?? "")).length), 500);
  await row("big").click();
  console.log("PASS a folder with more than 500 entries shows 500 and the cut note");

  // ---- open folders are remembered per pane folder
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  dialog = await openFiles(page);
  await row("a.md").waitFor();
  assert.equal(await row("docs").getAttribute("aria-expanded"), "true");
  console.log("PASS an open folder is open again when the dialog is reopened");
  await row("docs").click();

  // ---- the filter finds a folder the tree never opened, folded into one row
  const filter = dialog.getByRole("searchbox", { name: "Filter by name" });
  await filter.fill("target-note");
  await dialog.locator(".tree-sep").waitFor();
  assert.equal((await dialog.locator(".tree-sep").textContent())?.trim(), "src/lib/deep/");
  assert.deepEqual(await names(page), ["src/lib/deep/inner", "target-note.txt"]);
  assert.equal(await dialog.locator("mark.dir-browser-hit").textContent(), "target-note");
  assert.match(await dialog.locator(".dir-browser-scope").textContent() ?? "", /Search by name in git files/);
  await shot(page, "filter.png");
  await filter.press("ArrowDown");
  assert.equal(await focused(page), "/src/lib/deep/inner", "Down from the field enters the tree");
  // a folder of the result folds and unfolds in place, by Enter or click
  await page.keyboard.press("Enter");
  await dialog.getByRole("treeitem", { name: "target-note.txt" }).waitFor({ state: "detached" });
  assert.deepEqual(await names(page), ["src/lib/deep/inner"]);
  assert.equal(await dialog.getByRole("treeitem").first().getAttribute("aria-expanded"), "false");
  await page.keyboard.press("Enter");
  await dialog.getByRole("treeitem", { name: "target-note.txt" }).waitFor();
  await dialog.locator(".tree-row.is-folder").click();
  assert.equal(await dialog.getByRole("treeitem", { name: "target-note.txt" }).count(), 0);
  await dialog.locator(".tree-row.is-folder").click();
  await dialog.getByRole("treeitem", { name: "target-note.txt" }).waitFor();
  console.log("PASS the filter finds a nested file in a never-opened folder, folds the chain, marks the hit and says what it covers");

  await filter.fill("zzqqxx");
  await dialog.locator(".dir-browser-empty").waitFor();
  assert.match(await dialog.locator(".dir-browser-empty").textContent() ?? "", /Nothing found for “zzqqxx”/);
  console.log("PASS a filter with no match says so");

  // ---- Esc clears the filter, the second Esc closes
  await filter.focus();
  await page.keyboard.press("Escape");
  assert.equal(await filter.inputValue(), "");
  assert.equal(await dialog.isVisible(), true, "the first Esc only clears the filter");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  console.log("PASS Esc clears the filter and a second Esc closes the dialog");

  // ---- markdown drawn
  dialog = await openFiles(page);
  await row("README.md").click();
  const viewer = page.getByRole("dialog", { name: "README.md", exact: true });
  await viewer.locator(".file-viewer-render").waitFor();
  assert.equal(await viewer.getByRole("button", { name: "View", exact: true }).getAttribute("aria-pressed"), "true");
  assert.equal(await viewer.locator(".file-viewer-render .markdown-h1").textContent(), "Project title");
  assert.equal(await viewer.locator(".file-viewer-render li").count(), 2);
  assert.equal(await viewer.locator(".file-viewer-render script, .file-viewer-render img").count(), 0, "raw html in markdown makes no element");
  assert.match(await viewer.locator(".file-viewer-render").textContent() ?? "", /<script>window\.__pwned = 1<\/script>/);
  assert.equal(await viewer.getByRole("button", { name: "Edit", exact: true }).count(), 0, "no Edit while the file is drawn");
  const links = await viewer.locator(".file-viewer-render a").evaluateAll((anchors) => anchors.map((a) => [a.getAttribute("href"), a.getAttribute("target"), a.getAttribute("rel")]));
  assert.deepEqual(links, [["https://example.com/", "_blank", "noopener noreferrer"]]);
  // (a script that was going to run has run by the time two frames are painted)
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  assert.equal(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned), undefined, "nothing in the markdown ran");
  assert.equal(await viewer.locator(".file-viewer-render").evaluate((el) => el.closest("[data-feedback-private]") !== null), true, "the drawn file sits in a private surface");
  await shot(page, "md.png");
  console.log("PASS markdown is drawn, hostile markup stays text, links open safely, and there is no Edit");

  await viewer.getByRole("button", { name: "Code", exact: true }).click();
  await viewer.locator(".file-viewer-text").waitFor();
  await viewer.getByRole("button", { name: "Edit", exact: true }).waitFor();
  await viewer.getByRole("button", { name: "Close file", exact: true }).click();
  await row("README.md").click();
  await viewer.locator(".file-viewer-text").waitFor();
  assert.equal(await viewer.getByRole("button", { name: "Code", exact: true }).getAttribute("aria-pressed"), "true", "the choice is remembered");
  await viewer.getByRole("button", { name: "View", exact: true }).click();
  await viewer.locator(".file-viewer-render").waitFor();
  assert.equal(await viewer.getByRole("button", { name: "Edit", exact: true }).count(), 0);
  await viewer.getByRole("button", { name: "Close file", exact: true }).click();
  console.log("PASS Code shows the text with Edit (only there), and the choice is remembered");

  // ---- html in an empty sandbox
  await row("page.html").click();
  const html = page.getByRole("dialog", { name: "page.html", exact: true });
  const frame = html.locator("iframe.file-viewer-html");
  await frame.waitFor();
  assert.equal(await frame.getAttribute("sandbox"), "", "an empty sandbox: no allow-* at all");
  assert.equal(await html.getByRole("button", { name: "View", exact: true }).getAttribute("aria-pressed"), "true");
  await html.getByText("Scripts are off in this view").waitFor();
  const inside = html.frameLocator("iframe.file-viewer-html");
  await inside.getByRole("heading", { name: "Report" }).waitFor();
  await page.waitForLoadState("networkidle"); // the image and the stylesheet would have been asked for by now
  assert.deepEqual(remote, [], "the html file fetched nothing from outside (the CSP blocks the image and the stylesheet)");
  assert.equal(await inside.locator("head > meta").first().getAttribute("http-equiv"), "Content-Security-Policy", "the policy is the first element of the head");
  assert.equal(await inside.locator("#x").textContent(), "script off", "the page's script did not run");
  assert.equal(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned), undefined);
  await shot(page, "html.png");
  console.log("PASS html is drawn in an empty sandbox and its script does not run");
  await html.getByRole("button", { name: "Close file", exact: true }).click();
  await page.keyboard.press("Escape");

  // ---- a phone
  const phone = await open(true);
  const sheet = await openFiles(phone);
  await sheet.locator(".tree-row", { hasText: "docs" }).click();
  await sheet.locator(".tree-row", { hasText: "a.md" }).waitFor();
  const measured = await phone.evaluate(() => {
    const dialogBox = document.querySelector<HTMLElement>(".files-dialog")!;
    const touch = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--touch-target"));
    return {
      page: document.documentElement.scrollWidth, inner: window.innerWidth, dialog: dialogBox.scrollWidth, dialogClient: dialogBox.clientWidth,
      hints: getComputedStyle(document.querySelector(".dir-browser-hints")!).display, rowHeight: document.querySelector<HTMLElement>(".tree-row")!.getBoundingClientRect().height, touch,
    };
  });
  assert.ok(measured.page <= measured.inner, `page overflows: ${measured.page}/${measured.inner}`);
  assert.ok(measured.dialog <= measured.dialogClient, `dialog overflows: ${measured.dialog}/${measured.dialogClient}`);
  assert.equal(measured.hints, "none", "keyboard hints are hidden on a phone");
  assert.ok(measured.rowHeight >= measured.touch - 1, `rows are under the touch size: ${measured.rowHeight}`);
  await shot(phone, "phone-tree.png");
  await sheet.locator(".tree-row", { hasText: "README.md" }).click();
  const small = phone.getByRole("dialog", { name: "README.md", exact: true });
  await small.locator(".file-viewer-render").waitFor();
  const body = await phone.evaluate(() => { const b = document.querySelector<HTMLElement>(".file-viewer-body")!; return [b.scrollWidth, b.clientWidth, document.documentElement.scrollWidth, window.innerWidth]; });
  assert.ok(body[0]! <= body[1]! && body[2]! <= body[3]!, `the viewer overflows on a phone: ${body.join("/")}`);
  console.log("PASS phone 390: tree and drawn markdown without horizontal overflow, touch-size rows, no hints");

  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  server?.stop();
  if (workspace) await workspaceClose(workspace).catch(() => undefined);
  rmSync(root, { recursive: true, force: true });
}
