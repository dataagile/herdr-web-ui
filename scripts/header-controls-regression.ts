/** The header's own controls: copy path, Files and the bell at every width, an icons-only bar on a phone, and the drawer's path and palette rows. */
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
    // no hysteresis: the crumb's state at a width is the same going down to it and coming back up to it
    await page.evaluate(() => { document.querySelector(".context-title-text")!.textContent = "a title"; });
    const crumbHiddenAt = async (width: number): Promise<boolean> => {
      await page.setViewportSize({ width, height: 700 });
      await page.waitForTimeout(300);
      return page.evaluate(() => document.querySelector(".context")!.classList.contains("is-crumb-hidden"));
    };
    const widths = [1440, 1300, 1200, 1100, 1000, 900, 800, 700, 600, 500];
    const down = new Map<number, boolean>();
    for (const width of widths) down.set(width, await crumbHiddenAt(width));
    for (const width of [...widths].reverse()) assert.equal(await crumbHiddenAt(width), down.get(width), `the crumb's state at ${width}px does not depend on the way there`);
    // the title's copy button keeps its room hidden, and a hidden one is not focusable
    await crumbHiddenAt(1440);
    assert.equal(await page.locator(".context-copy.in-title").evaluate((node) => getComputedStyle(node).visibility), "hidden", `a drawn crumb: the title's copy button is hidden, not removed ${JSON.stringify([...down])}`);
    assert.ok((await page.locator(".context-copy.in-title").boundingBox())!.width > 0, "the title's copy button keeps its room");
  } finally {
    await desktop.close();
  }
  console.log("PASS the header's copy path and Files buttons on a desktop");

  // phone: the bar is icons only (no title); Files and the bell stay in it; the drawer has the path and the palette
  for (const width of [390, 360]) {
    const phone = await open({ width, height: 844 }, true);
    try {
      const { page } = phone;
      assert.equal(await visibleCount(page, ".context-title-text, .context-sub, .context .agent-mark"), 0, `phone ${width}: no title text, crumb or agent mark in the header`);
      assert.equal(await visibleCount(page, ".context-copy.in-title"), 1, `phone ${width}: the copy button is in the header`);
      assert.equal(await visibleCount(page, ".context-copy.in-crumb"), 0, `phone ${width}: the crumb's copy button is not shown`);
      for (const selector of [".drawer-toggle", ".header-new-tab", ".header-split", ".header-files", ".header-bell button", ".view-switch button"]) {
        assert.ok(await visibleCount(page, `.app-header ${selector}`) >= 1, `phone ${width}: ${selector} is in the header`);
      }
      for (const selector of [".app-header .btn", ".app-header .icon-button", ".app-header .view-switch button"]) {
        for (const rect of await page.locator(selector).evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()).filter((r) => r.width > 0))) {
          assert.ok(rect.height >= 40 && rect.width >= 40, `phone ${width}: ${selector} keeps the 40px touch target (${rect.width}x${rect.height})`);
        }
      }
      // every header button is named for hover and for a screen reader, whatever labels the width drops
      const unnamed = await page.locator(".app-header button").evaluateAll((nodes) => nodes.filter((node) => !node.getAttribute("title") || !node.getAttribute("aria-label")).map((node) => node.className));
      assert.deepEqual(unnamed, [], `phone ${width}: every header button has a title and an aria-label`);
      const fit = await page.evaluate(() => {
        const header = document.querySelector(".app-header")!;
        return { doc: document.documentElement.scrollWidth, view: document.documentElement.clientWidth, header: header.scrollWidth, headerBox: header.clientWidth };
      });
      assert.ok(fit.doc <= fit.view && fit.header <= fit.headerBox, `phone ${width}: no horizontal overflow ${JSON.stringify(fit)}`);
      console.log(`MEASURE phone ${width}: header scrollWidth ${fit.header} / ${fit.headerBox}, document ${fit.doc} / ${fit.view}`);
      if (width !== 390) continue;
      await page.locator(".context-copy.in-title").tap();
      await page.waitForFunction(() => document.querySelector(".context-copy.in-title")?.getAttribute("title") === "Path copied");
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), path, "phone: the button copies the pane's folder");
      assert.equal(await page.locator(".context-copy.in-title svg.lucide-check").count(), 1);
      await page.locator(".app-header .header-files").tap();
      await page.getByRole("dialog", { name: "Files" }).waitFor();
      await page.keyboard.press("Escape");
      assert.equal(await visibleCount(page, ".app-header > .header-new-tab"), 1, "phone: New tab is in the header");
      // this harness has one pane per tab, so no real zoom: the class App.tsx sets while zoomed is applied by hand
      await page.evaluate(() => document.querySelector(".app-header")?.classList.add("has-unzoom"));
      assert.equal(await visibleCount(page, ".app-header > .header-new-tab"), 0, "phone: a zoomed tab hides the header's New tab");
      await page.evaluate(() => document.querySelector(".app-header")?.classList.remove("has-unzoom"));
      await page.getByRole("button", { name: "Open project list", exact: true }).tap();
      assert.equal((await page.locator(".drawer-path").innerText()).replace(/\s+/g, ""), path, "phone: the drawer's first line is the pane's full path");
      assert.equal(await visibleCount(page, "#workspace-drawer .drawer-palette"), 1, "phone: the drawer shows the palette row");
      assert.equal(await page.locator(".drawer-files, .drawer-alerts").count(), 0, "phone: the drawer has no Files or Alerts row");
      assert.equal(await page.locator(".drawer-toggle .header-bell-dot").count(), 0, "phone: the drawer toggle carries no dot");
    } finally {
      await phone.close();
    }
  }
  console.log("PASS the phone's icon-only header and drawer rows");

  // a touch tablet (481-768px) keeps Files and the bell in the header too, labels dropped; the drawer has path and palette
  const tablet = await open({ width: 600, height: 900 }, true);
  try {
    const { page } = tablet;
    assert.equal(await visibleCount(page, ".app-header .header-files, .app-header .header-bell"), 2, "tablet: Files and the bell are in the header");
    await page.getByRole("button", { name: "Open project list", exact: true }).tap();
    assert.equal((await page.locator(".drawer-path").innerText()).replace(/\s+/g, ""), path, "tablet: the drawer's first line is the pane's full path");
    assert.equal(await page.locator(".drawer-files, .drawer-alerts").count(), 0, "tablet: no Files or Alerts row");
    assert.equal(await visibleCount(page, "#workspace-drawer .drawer-palette"), 0, "tablet: the palette row is not in the drawer, the header has the button");
    assert.equal(await visibleCount(page, ".app-header .palette-button"), 1, "tablet: the palette button is in the header");
  } finally {
    await tablet.close();
  }
  console.log("PASS the touch tablet's header and drawer");
}
