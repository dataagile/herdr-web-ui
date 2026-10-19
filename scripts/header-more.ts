/**
 * Upstream's browser scripts reach a few controls through the header's More menu. The fork has no
 * More menu (each control is a header button or a drawer row), so this runs the fork's own control
 * for the item upstream names. Alerts are in header-bell.ts.
 */
import type { Page } from "playwright-core";

const CONTROLS: Record<string, string> = {
  "Browse files": ".app-header .header-files",
  "New tab": ".app-header .header-new-tab",
};

/** Runs the control that stands for the More menu's item `label`. */
export async function runMoreItem(page: Page, label: string): Promise<void> {
  const selector = CONTROLS[label];
  if (!selector) throw new Error(`the fork has no stand-in for the More menu's "${label}"`);
  await page.locator(selector).click();
}
