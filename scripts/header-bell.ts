/**
 * The header's Alerts button (the bell), for the browser scripts. It is a switch: aria-pressed
 * says whether alerts are on, its title says how ("pushed to this device", "while the app is open").
 */
import type { Page } from "playwright-core";

const BELL = ".app-header .header-bell button";

/** Taps the bell. */
export async function tapBell(page: Page): Promise<void> {
  await page.locator(BELL).click();
}

/** Whether alerts are on for this device, and the title that says how. */
export async function alertsState(page: Page): Promise<{ on: boolean; title: string }> {
  const bell = page.locator(BELL);
  return { on: (await bell.getAttribute("aria-pressed")) === "true", title: (await bell.getAttribute("title")) ?? "" };
}

/** Whether the bell carries the dot: alerts are off on this device. The dot and the pressed state have to agree. */
export async function alertsOffMarked(page: Page): Promise<boolean> {
  const dot = (await page.locator(".app-header .header-bell .header-bell-dot").count()) === 1;
  const on = (await alertsState(page)).on;
  if (dot === on) throw new Error(`the bell's dot (${dot}) and its pressed state (${on}) disagree`);
  return dot;
}
