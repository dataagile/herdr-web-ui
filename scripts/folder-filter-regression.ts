import assert from "node:assert/strict";
import type { Page, Locator } from "playwright-core";

/** The owned fixture directory has only a and b; no workspace is created by this check. */
export async function checkFolderFilter(page: Page, dialog: Locator, createRequests: () => number): Promise<void> {
  const until = async (check: () => Promise<boolean>, label: string) => {
    const deadline = Date.now() + 5_000;
    while (!(await check())) {
      assert.ok(Date.now() < deadline, label);
      await page.waitForTimeout(50);
    }
  };
  await dialog.getByRole("button", { name: "Browse", exact: true }).click();
  const filter = dialog.getByRole("searchbox", { name: "Filter folders" });
  await filter.waitFor();
  await filter.fill("A");
  await until(async () => (await dialog.locator(".dir-browser-item").allTextContents()).join() === "a", "case-insensitive folder filter");
  const composition = await filter.evaluate((input) => [
    { key: "Enter", isComposing: true },
    { key: "Enter", keyCode: 229 },
    { key: "Escape", isComposing: true },
  ].map((init) => input.dispatchEvent(new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true }))));
  assert.deepEqual(composition, [true, true, true], "IME candidate keys keep their default action");
  assert.equal(await filter.inputValue(), "A", "IME Escape does not clear the filter");
  assert.equal(await dialog.isVisible(), true, "IME Escape does not close the dialog");
  assert.equal(await filter.evaluate((input) => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))), false, "plain Enter cannot submit the form");
  assert.equal(createRequests(), 0, "filter keys create no workspace");
  await filter.fill("no-matching-folder");
  await dialog.getByText("No matching folders", { exact: true }).waitFor();
  await filter.press("Escape");
  assert.equal(await filter.inputValue(), "");
  assert.equal(await dialog.isVisible(), true, "Escape clears before closing");
  // the New folder field keeps the same keys: IME candidates are its own, Escape cancels the field
  // before it can close the dialog, and nothing is created
  await dialog.getByRole("button", { name: "New folder", exact: true }).click();
  const folderName = dialog.getByRole("textbox", { name: "Folder name" });
  await folderName.waitFor();
  await folderName.fill("zz-never-created");
  const nameComposition = await folderName.evaluate((input) => [
    { key: "Enter", isComposing: true },
    { key: "Enter", keyCode: 229 },
    { key: "Escape", isComposing: true },
  ].map((init) => input.dispatchEvent(new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true }))));
  assert.deepEqual(nameComposition, [true, true, true], "IME candidate keys keep their default action in the folder name");
  assert.equal(await folderName.inputValue(), "zz-never-created", "IME Escape does not clear the folder name");
  assert.equal(await dialog.isVisible(), true, "IME Escape in the folder name does not close the dialog");
  await folderName.press("Escape");
  await folderName.waitFor({ state: "detached" });
  assert.equal(await dialog.isVisible(), true, "Escape cancels the folder name before closing the dialog");
  assert.equal(await dialog.locator(".dir-browser-item").filter({ hasText: "zz-never-created" }).count(), 0, "cancelling creates no folder");
  await filter.fill("a");
  await dialog.locator(".dir-browser-item").click();
  await until(async () => (await filter.inputValue()) === "", "navigation clears the filter");
  await dialog.getByRole("button", { name: "Parent folder", exact: true }).click();
  await dialog.getByRole("button", { name: "Use this folder", exact: true }).click();
  await filter.waitFor({ state: "detached" });
  console.log("PASS folder filtering and the New folder field preserve IME keys, keep Escape inside the field, and the filter clears on navigation");
}
