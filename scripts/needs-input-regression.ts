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
  let extra = false;
  try {
    // both PCs start folded: Needs you must still show, so a waiting agent is never hidden
    await context.addInitScript(() => {
      localStorage.setItem("herdr-web-ui:pc-collapsed:local", "1");
      localStorage.setItem("herdr-web-ui:pc-collapsed:qa-remote", "1");
    });
    await context.route("**/api/machines/events", (route) => route.abort());
    await context.route("**/api/machines", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const local = body.machines.find((machine: any) => machine.id === "local");
      const pane = local.snapshot.panes.find((pane: any) => pane.pane_id === paneId);
      local.name = "QA host";
      // the done pane is listed first in the roster: Needs you still puts the blocked one on top
      local.snapshot.panes = [{ ...pane, pane_id: `${paneId}-done`, label: "Local finished", agent: "claude", agent_status: seen ? "idle" : "done" }, { ...pane, label: "Local waiting", agent: "claude", agent_status: resumed ? "working" : "blocked" }, ...(extra ? [{ ...pane, pane_id: `${paneId}-extra`, label: "Local extra", agent: "claude", agent_status: "blocked" }] : [])];
      local.snapshot.workspaces = local.snapshot.workspaces.filter((workspace: any) => workspace.workspace_id === pane.workspace_id);
      const remote = { ...local, id: "qa-remote", kind: "ssh", name: "QA remote", state: offline ? "disconnected" : "connected", snapshot: { ...local.snapshot, panes: [{ ...pane, label: "Remote waiting", agent: "codex", agent_status: "blocked" }] } };
      await route.fulfill({ json: { machines: [local, remote] } });
    });
    // the server's answer to a done pane opened in the browser: it reads idle from then on
    const seenBodies: unknown[] = [];
    await context.route("**/api/pane/seen", async (route) => {
      seenBodies.push(route.request().postDataJSON());
      // the first answer is a transient failure: the pane stays done, and the next user action retries
      if (seenBodies.length === 1) return route.fulfill({ status: 502, json: { error: { code: "qa_bad_gateway", message: "Stand-in failure" } } });
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
    assert.equal(await host.locator(".needs-input-select").count(), 2);
    assert.equal(await remote.locator(".needs-input-select").count(), 1);
    assert.deepEqual(await host.locator(".pane-title").allTextContents(), ["Local waiting", "Local finished"]);
    assert.deepEqual(await host.locator(".badge").allTextContents(), ["INPUT", "DONE"]);
    assert.equal(await host.locator(".pill").textContent(), "2");
    assert.equal(await page.locator(".machine-list > section.needs-input").count(), 0);
    // one landmark per PC, told apart by name
    assert.equal(await host.getAttribute("aria-label"), "Needs you on QA host");
    assert.equal(await remote.getAttribute("aria-label"), "Needs you on QA remote");
    // both PCs are folded: no Projects, and the block is still there
    assert.equal(await page.locator(".machine-group .sidebar-section-header:not(.needs-input-toggle)").count(), 0);
    // unfolded, it sits under the PC's header, above its Projects section
    await page.locator('.machine-group[aria-label="PC QA host"] .machine-toggle').click();
    await page.locator('.machine-group[aria-label="PC QA host"] .sidebar-section-header:not(.needs-input-toggle)').first().waitFor();
    assert.equal(await host.evaluate((el) => {
      const group = el.closest(".machine-group")!;
      const before = (a: Element, b: Element | null) => b !== null && Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return before(group.querySelector(".machine-header")!, el) && before(el, group.querySelector(".sidebar-section-header:not(.needs-input-toggle)"));
    }), true);
    assert.equal(await page.locator('.machine-list > [role="status"]').textContent(), "Panes waiting for input: 2");
    // the heading folds the rows and keeps the count; the choice survives a reload; unfolding shows the rows again
    const hostToggle = host.getByRole("button", { name: /^Needs you/ });
    assert.equal(await hostToggle.getAttribute("aria-expanded"), "true");
    await hostToggle.click();
    assert.equal(await hostToggle.getAttribute("aria-expanded"), "false");
    assert.equal(await host.getByRole("button", { name: /Local waiting/ }).count(), 0);
    assert.equal(await host.locator(".pill").textContent(), "2");
    assert.equal(await page.locator('.machine-list > [role="status"]').textContent(), "Panes waiting for input: 2");
    assert.equal(await remote.getByRole("button", { name: /Remote waiting/ }).count(), 1);
    // a new waiting pane (via the same stand-in listing) updates the count but never reopens the folded block
    extra = true;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await host.locator(".pill").filter({ hasText: "3" }).waitFor();
    assert.equal(await hostToggle.getAttribute("aria-expanded"), "false");
    assert.equal(await host.getByRole("button", { name: /Local extra/ }).count(), 0);
    extra = false;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await host.locator(".pill").filter({ hasText: "2" }).waitFor();
    await page.reload();
    await hostToggle.waitFor();
    assert.equal(await hostToggle.getAttribute("aria-expanded"), "false");
    assert.equal(await host.getByRole("button", { name: /Local waiting/ }).count(), 0);
    await hostToggle.click();
    assert.equal(await host.getByRole("button", { name: /Local waiting/ }).count(), 1);
    await remote.getByRole("button", { name: /Remote waiting/ }).click();
    await page.locator(".context .machine-context-name").filter({ hasText: "QA remote" }).waitFor();
    assert.equal(await remote.getByRole("button", { name: /Remote waiting/ }).getAttribute("aria-current"), "true");
    assert.equal(await host.getByRole("button", { name: /Local waiting/ }).getAttribute("aria-current"), null);
    await host.getByRole("button", { name: /Local waiting/ }).click();
    await page.locator(".context .machine-context-name").filter({ hasText: "QA host" }).waitFor();
    await page.locator(".conn-live").waitFor();
    // folding or unfolding a PC never hides its block
    const remoteToggle = page.locator('.machine-group[aria-label="PC QA remote"] .machine-toggle');
    await remoteToggle.click();
    assert.equal(await remoteToggle.getAttribute("aria-expanded"), "true");
    await remote.waitFor();
    await remoteToggle.click();
    assert.equal(await remoteToggle.getAttribute("aria-expanded"), "false");
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
    // a 502 did not use up the one request: the user coming back to the page with the pane in front retries
    const retried = page.waitForResponse("**/api/pane/seen");
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await retried;
    assert.deepEqual(seenBodies, [{ pane_id: `${paneId}-done` }, { pane_id: `${paneId}-done` }]);
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await host.waitFor({ state: "detached" });
    offline = true;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await remote.waitFor({ state: "detached" });
    assert.equal(await page.locator('.machine-list > [role="status"]').textContent(), "Panes waiting for input: 0");
    assert.deepEqual(errors, []);
    console.log("PASS Needs you: one block per PC, blocked then done, same pane IDs, selection, folded PCs keep the block, resume, seen, offline and mobile drawer");
  } finally { await context.close(); }
}
