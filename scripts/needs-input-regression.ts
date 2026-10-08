import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Browser } from "playwright-core";

/** Duplicate an owned pane's ID on a stand-in remote PC to catch routing by pane ID alone. */
export async function checkNeedsInput(browser: Browser, origin: string, paneId: string): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  let resumed = false;
  let seen = false;
  let offline = false;
  try {
    await context.route("**/api/machines/events", (route) => route.abort());
    await context.route("**/api/machines", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const local = body.machines.find((machine: any) => machine.id === "local");
      const pane = local.snapshot.panes.find((pane: any) => pane.pane_id === paneId);
      local.name = "QA host";
      // the done pane is listed first in the roster: Needs you still puts the blocked one on top
      local.snapshot.panes = [{ ...pane, pane_id: `${paneId}-done`, label: "Local finished", agent: "claude", agent_status: seen ? "idle" : "done" }, { ...pane, label: "Local waiting", agent: "claude", agent_status: resumed ? "working" : "blocked" }];
      local.snapshot.workspaces = local.snapshot.workspaces.filter((workspace: any) => workspace.workspace_id === pane.workspace_id);
      const remote = { ...local, id: "qa-remote", kind: "ssh", name: "QA remote", state: offline ? "disconnected" : "connected", snapshot: { ...local.snapshot, panes: [{ ...pane, label: "Remote waiting", agent: "codex", agent_status: "blocked" }] } };
      await route.fulfill({ json: { machines: [local, remote] } });
    });
    // the server's answer to a done pane opened in the browser: it reads idle from then on
    const seenBodies: unknown[] = [];
    await context.route("**/api/pane/seen", async (route) => {
      seenBodies.push(route.request().postDataJSON());
      seen = true;
      await route.fulfill({ json: { ok: true, changed: true } });
    });
    await context.route("**/api/machines/qa-remote/**", (route) => route.fulfill({ status: 503, json: { error: { code: "qa_remote", message: "Stand-in PC" } } }));
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/?pane=${encodeURIComponent(paneId)}`);
    const host = page.locator('.machine-group[aria-label="PC QA host"] .needs-input');
    const remote = page.locator('.machine-group[aria-label="PC QA remote"] .needs-input');
    await host.getByRole("button", { name: /Local waiting/ }).waitFor();
    // one block per PC, with that PC's panes only, blocked before done, workspace as the subtitle
    assert.equal(await host.getByRole("button").count(), 2);
    assert.equal(await remote.getByRole("button").count(), 1);
    assert.deepEqual(await host.locator(".pane-title").allTextContents(), ["Local waiting", "Local finished"]);
    assert.deepEqual(await host.locator(".badge").allTextContents(), ["INPUT", "DONE"]);
    assert.equal(await host.locator(".pill").textContent(), "2");
    assert.equal(await page.locator(".machine-list > section.needs-input").count(), 0);
    // under the PC's header, above its Projects section
    assert.equal(await host.evaluate((el) => {
      const group = el.closest(".machine-group")!;
      const before = (a: Element, b: Element | null) => b !== null && Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return before(group.querySelector(".machine-header")!, el) && before(el, group.querySelector(".sidebar-section-header"));
    }), true);
    assert.equal(await page.locator('.machine-list > [role="status"]').textContent(), "Panes waiting for you: 3");
    await remote.getByRole("button", { name: /Remote waiting/ }).click();
    await page.locator(".context .machine-context-name").filter({ hasText: "QA remote" }).waitFor();
    assert.equal(await remote.getByRole("button", { name: /Remote waiting/ }).getAttribute("aria-current"), "true");
    assert.equal(await host.getByRole("button", { name: /Local waiting/ }).getAttribute("aria-current"), null);
    await host.getByRole("button", { name: /Local waiting/ }).click();
    await page.locator(".context .machine-context-name").filter({ hasText: "QA host" }).waitFor();
    await page.locator(".conn-live").waitFor();
    // the block folds with its PC
    await page.locator('.machine-group[aria-label="PC QA remote"] .machine-toggle').click();
    await remote.waitFor({ state: "detached" });
    await page.locator('.machine-group[aria-label="PC QA remote"] .machine-toggle').click();
    await remote.waitFor();
    if (process.env.UI_EVIDENCE_DIR) {
      mkdirSync(process.env.UI_EVIDENCE_DIR, { recursive: true });
      await page.screenshot({ path: join(process.env.UI_EVIDENCE_DIR, "needs-input-desktop.png") });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('[aria-controls="workspace-drawer"]').click();
      await remote.getByRole("button", { name: /Remote waiting/ }).waitFor();
      await page.waitForFunction(() => (document.getElementById("workspace-drawer")?.getBoundingClientRect().x ?? -1) >= 0);
      await page.screenshot({ path: join(process.env.UI_EVIDENCE_DIR, "needs-input-mobile.png") });
      await host.getByRole("button", { name: /Local waiting/ }).click();
      assert.equal(await page.locator('[aria-controls="workspace-drawer"]').getAttribute("aria-expanded"), "false");
    }
    resumed = true;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await host.getByRole("button", { name: /Local waiting/ }).waitFor({ state: "detached" });
    assert.equal(await host.getByRole("button", { name: /Local finished/ }).count(), 1);
    // opening a done pane in the web marks it seen, once, without herdr's focus moving; it leaves the block
    assert.deepEqual(seenBodies, []);
    const posted = page.waitForRequest("**/api/pane/seen");
    await host.getByRole("button", { name: /Local finished/ }).click();
    await posted;
    assert.deepEqual(seenBodies, [{ pane_id: `${paneId}-done` }]);
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await host.waitFor({ state: "detached" });
    offline = true;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await remote.waitFor({ state: "detached" });
    assert.equal(await page.locator('.machine-list > [role="status"]').textContent(), "Panes waiting for you: 0");
    assert.deepEqual(errors, []);
    console.log("PASS Needs you: one block per PC, blocked then done, same pane IDs, selection, fold, resume, seen, offline and mobile drawer");
  } finally { await context.close(); }
}
