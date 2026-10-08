import type { Page } from "playwright-core";

/**
 * Puts the pane in the chat or the terminal lens by the header's own control: the Chat/Terminal switch,
 * or on a phone (480px and below), where that switch is hidden, the single toggle that goes to the other lens.
 */
export async function setLens(page: Page, lens: "chat" | "terminal"): Promise<void> {
  const toggle = page.locator(".view-toggle");
  if (await toggle.isVisible()) {
    // the toggle names the lens a tap goes to: when it names this one, the pane is not in it yet
    if ((await toggle.getAttribute("aria-label")) === (lens === "chat" ? "Switch to Chat" : "Switch to Terminal")) await toggle.click();
    return;
  }
  await page.getByTitle(lens === "chat" ? "Chat transcript (⌘⇧J)" : "Live terminal (⌘⇧J)", { exact: true }).click();
}
