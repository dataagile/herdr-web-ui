import assert from "node:assert/strict";
import type { Page, Locator } from "playwright-core";

/** The owned fixture directory has only a and b; no workspace is created by this check. Browse opens the Files tree in pick mode. */
export async function checkFolderFilter(page: Page, dialog: Locator, createRequests: () => number): Promise<void> {
  const until = async (check: () => Promise<boolean>, label: string) => {
    const deadline = Date.now() + 5_000;
    while (!(await check())) {
      assert.ok(Date.now() < deadline, label);
      await page.waitForTimeout(50);
    }
  };
  await dialog.getByRole("button", { name: "Browse", exact: true }).click();
  const filter = dialog.getByRole("searchbox", { name: "Filter by name" });
  const rows = dialog.getByRole("treeitem");
  await rows.first().waitFor();
  await filter.waitFor();
  await filter.fill("A");
  await until(async () => (await rows.allTextContents()).join() === "a", "case-insensitive folder filter");
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
  await dialog.getByText("Nothing found for “no-matching-folder”", { exact: true }).waitFor();
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
  assert.equal(await rows.filter({ hasText: "zz-never-created" }).count(), 0, "cancelling creates no folder");
  await filter.fill("a");
  await rows.filter({ hasText: /^a$/ }).click();
  await until(async () => (await filter.inputValue()) === "", "picking a folder in the filter's result clears the filter");
  await until(async () => (await rows.filter({ hasText: /^a$/ }).first().getAttribute("aria-selected")) === "true", "the clicked folder is the selected one");
  const path = dialog.locator(".dir-browser-path").first();
  const before = await path.textContent();
  await dialog.getByRole("button", { name: "Parent folder", exact: true }).click();
  await until(async () => (await path.textContent()) !== before, "Up moves the root");
  // with nothing selected, "Use this folder" takes the root as moved by Up; the field gets the fixture folder back for the rest of the run
  const directory = dialog.getByLabel(/^Directory/);
  const moved = ((await path.textContent()) ?? "").trim();
  await dialog.getByRole("button", { name: "Use this folder", exact: true }).click();
  await filter.waitFor({ state: "detached" });
  await until(async () => (await directory.inputValue()) === moved, "Use this folder fills the directory field with the root");
  await directory.fill((before ?? "").trim());
  console.log("PASS folder filtering and the New folder field preserve IME keys, keep Escape inside the field, and picking a folder clears the filter");
}
