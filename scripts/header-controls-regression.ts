/** The header's own controls: copy path, Files, and (on a phone) the drawer rows that take Files and Alerts. */
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import type { Browser, Page } from "playwright-core";

const visibleCount = (page: Page, selector: string): Promise<number> =>
  page.locator(selector).evaluateAll((nodes) => nodes.filter((node) => {
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== "hidden";
  }).length);

export async function checkHeaderControls(browser: Browser, origin: string, paneId: string, cwd: string): Promise<void> {
  const path = realpathSync(cwd);
  const open = async (viewport: { width: number; height: number }, phone: boolean): Promise<{ page: Page; close: () => Promise<void> }> => {
    const context = await browser.newContext({ viewport, locale: "en-US", ...(phone ? { isMobile: true, hasTouch: true } : { permissions: ["clipboard-read", "clipboard-write"] }) });
    await context.addInitScript(() => {
      if (localStorage.getItem("herdr-web-ui:settings") === null) localStorage.setItem("herdr-web-ui:settings", JSON.stringify({ language: "en" }));
    });
    if (phone) await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
    const page = await context.newPage();
    await page.goto(`${origin}/?pane=${encodeURIComponent(paneId)}`);
    await page.locator(".conn-live").waitFor();
    await page.locator(".context-copy").first().waitFor({ state: "attached" });
    return { page, close: () => context.close() };
  };

  // desktop: the crumb is drawn, so the copy button is at its end and the title has none; Files opens the file browser
  const desktop = await open({ width: 1440, height: 900 }, false);
  try {
    const { page } = desktop;
    assert.equal(await visibleCount(page, ".context-copy.in-crumb"), 1, "desktop: the copy button is at the end of the crumb");
    assert.equal(await visibleCount(page, ".context-copy.in-title"), 0, "desktop: the title has no second copy button");
    await page.locator(".context-copy.in-crumb").click();
    await page.waitForFunction(() => document.querySelector(".context-copy.in-crumb")?.getAttribute("title") === "Path copied");
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), path, "the button copies the pane's folder");
    assert.equal(await page.locator(".context-copy.in-crumb svg.lucide-check").count(), 1, "the button shows the check once copied");
    assert.equal(await visibleCount(page, ".app-header .header-files"), 1, "desktop: Files is in the header");
    assert.equal(await visibleCount(page, ".app-header .header-bell"), 1, "desktop: the bell is in the header");
    await page.locator(".app-header .header-files").click();
    await page.getByRole("dialog", { name: "Files" }).waitFor();
    await page.keyboard.press("Escape");
    // a crumb that does not fit wraps out of sight with its button: the title's takes over, never both
    await page.setViewportSize({ width: 900, height: 700 });
    await page.evaluate(() => { document.querySelector(".context-title-text")!.textContent = "a very long title ".repeat(8); });
    await page.waitForFunction(() => document.querySelector(".context")?.classList.contains("is-crumb-hidden"));
    assert.equal(await visibleCount(page, ".context-copy.in-title"), 1, "a wrapped crumb: the copy button is beside the title");
    assert.equal(await visibleCount(page, ".context-copy.in-crumb"), 0, "a wrapped crumb: its copy button is not shown");
  } finally {
    await desktop.close();
  }
  console.log("PASS the header's copy path and Files buttons on a desktop");

  // phone: the copy button is beside the title; Files and the bell are rows of the drawer
  const phone = await open({ width: 390, height: 844 }, true);
  try {
    const { page } = phone;
    assert.equal(await visibleCount(page, ".context-copy.in-title"), 1, "phone: the copy button is beside the title");
    assert.equal(await visibleCount(page, ".context-copy.in-crumb"), 0, "phone: the crumb's copy button is not shown");
    await page.locator(".context-copy.in-title").tap();
    await page.waitForFunction(() => document.querySelector(".context-copy.in-title")?.getAttribute("title") === "Path copied");
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), path, "phone: the button copies the pane's folder");
    assert.equal(await page.locator(".context-copy.in-title svg.lucide-check").count(), 1);
    assert.equal(await visibleCount(page, ".app-header .header-files, .app-header .header-bell"), 0, "phone: the header has neither Files nor the bell");
    for (const selector of [".drawer-toggle", ".context-copy.in-title", ".app-header > .btn", ".app-header .icon-button:not(.drawer-toggle):not(.context-copy)"]) {
      for (const size of await page.locator(selector).evaluateAll((nodes) => nodes.filter((node) => node.getBoundingClientRect().width > 0).map((node) => node.getBoundingClientRect().height))) {
        assert.ok(size >= 40, `phone: ${selector} keeps the 40px touch target (${size}px)`);
      }
    }
    assert.equal(await visibleCount(page, ".app-header > .header-new-tab"), 1, "phone: New tab is in the header");
    // this harness has one pane per tab, so no real zoom: the class App.tsx sets while zoomed is applied by hand
    await page.evaluate(() => document.querySelector(".app-header")?.classList.add("has-unzoom"));
    assert.equal(await visibleCount(page, ".app-header > .header-new-tab"), 0, "phone: a zoomed tab hides the header's New tab");
    await page.evaluate(() => document.querySelector(".app-header")?.classList.remove("has-unzoom"));
    await page.getByRole("button", { name: /^Open project list/ }).tap();
    assert.equal((await page.locator(".drawer-path").innerText()).replace(/\s+/g, ""), path, "phone: the drawer's first line is the pane's full path");
    for (const selector of [".drawer-palette", ".drawer-files", ".drawer-alerts"]) {
      assert.equal(await visibleCount(page, `#workspace-drawer ${selector}`), 1, `phone: the drawer shows ${selector}`);
    }
    assert.match(await page.locator(".drawer-alerts .drawer-hint").innerText(), /^On/, "the Alerts row says the device's state");
    await page.locator(".drawer-files").tap();
    await page.getByRole("dialog", { name: "Files" }).waitFor();
    assert.equal(await page.locator("#workspace-drawer.is-open").count(), 0, "Files closes the drawer");
  } finally {
    await phone.close();
  }
  console.log("PASS the phone's copy path button, header and drawer rows");
}
