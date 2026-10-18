// Captura do vídeo "Copiar caminho": app do repo (somente leitura) + transporte demo com textos pt-BR (cópia temporária)
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
const repo = process.env.DEVDA_REPO ?? new URL("../../..", import.meta.url).pathname; // raiz do fork
const demo = process.argv[3];
const out = process.argv[2] + "/";
const app = mkdtempSync(join(tmpdir(), "devda-cp-"));
const b = Bun.spawnSync([join(repo, "node_modules/.bin/vite"), "build", "--base", "./", "--outDir", app, "--emptyOutDir", "--logLevel", "warn"], { cwd: repo });
if (b.exitCode) throw new Error(new TextDecoder().decode(b.stderr));
const tb = await Bun.build({ entrypoints: [join(demo, "site/demo/transport.ts")], outdir: app, naming: "demo-transport.js", target: "browser", define: { __APP_VERSION__: JSON.stringify("0") } });
if (!tb.success) throw new Error(tb.logs.map(String).join("\n"));
const html = readFileSync(join(app, "index.html"), "utf8");
writeFileSync(join(app, "index.html"), html.replace(/<script type="module"/, () => `<script src="./demo-transport.js"></script>\n<script type="module"`));
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(r) {
  let f = decodeURIComponent(new URL(r.url).pathname.slice("/herdr-web-ui/demo/app/".length)); if (!f || f.endsWith("/")) f += "index.html";
  const body = Bun.file(join(app, f)); return (await body.exists()) ? new Response(body) : new Response("nf", { status: 404 }); } });
const url = `http://127.0.0.1:${server.port}/herdr-web-ui/demo/app/?pane=${encodeURIComponent("w1E:p1")}`;
const br = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ["--no-sandbox"] });
async function ctx(opts: any, fn: (p: any) => Promise<void>) {
  const c = await br.newContext({ locale: "pt-BR", permissions: ["clipboard-read", "clipboard-write", "notifications"], ...opts });
  await c.addInitScript(() => localStorage.setItem("herdr-web-ui:settings", JSON.stringify({ language: "pt" })));
  const p = await c.newPage(); p.setDefaultTimeout(30000); console.log("page"); p.on("pageerror", (e: any) => console.log("PAGEERROR", e.message));
  p.on("dialog", (d: any) => { console.log("DIALOG", d.message()); d.dismiss(); });
  await p.goto(url); await p.locator(".conn-live").waitFor({ state: "attached" }); await p.waitForTimeout(9000);
  await fn(p); await c.close();
}
const box = async (p: any, sel: string) => { if (!(await p.locator(sel).count())) return null; const b = await p.locator(sel).first().boundingBox({ timeout: 2000 }).catch(() => null); return b && [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 10) / 10); };
const rows = (p: any) => p.evaluate(() => Object.fromEntries([...document.querySelectorAll("[role=treeitem]")].map((e) => { const b = e.getBoundingClientRect(); return [e.getAttribute("data-path"), [b.x, b.y, b.width, b.height].map(Math.round)]; })));
const shot = async (p: any, n: string) => { await p.waitForTimeout(500); await p.screenshot({ path: out + n + ".png" }); };
const all = (p: any, sel: string) => p.evaluate((sel: string) => [...document.querySelectorAll(sel)].map((e) => { const b = e.getBoundingClientRect(); return [e.textContent?.trim().slice(0, 60), [b.x, b.y, b.width, b.height].map(Math.round)]; }), sel);
await ctx({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, timezoneId: "America/Sao_Paulo" }, async (p) => {
  await p.locator(".header-amod button").waitFor();
  console.log("amod", JSON.stringify({ btn: await box(p, ".header-amod button"), count: await box(p, ".header-amod-count"), label: await p.locator(".header-amod button").getAttribute("aria-label") }));
  await shot(p, "d-full");
  await p.locator(".header-amod button").hover(); await shot(p, "d-amod-hover");
  await p.locator(".header-amod button").click(); await p.locator(".changed-row").first().waitFor(); await p.mouse.move(1400, 880); await shot(p, "d-list");
  console.log("list", JSON.stringify({ dialog: await box(p, ".changed-dialog"), heads: await all(p, ".changed-heading"), notes: await all(p, ".changed-note"), rows: await all(p, ".changed-row"), pills: await all(p, ".changed-meta .pill"), times: await all(p, ".changed-time"), git: await all(p, ".changed-git") }));
  const row = p.locator(".changed-row", { hasText: "backup.sh" });
  await row.hover(); await shot(p, "d-list-hover");
  await row.click(); await p.locator(".changed-edit").first().waitFor(); await p.mouse.move(1400, 880); await shot(p, "d-changes");
  console.log("changes", JSON.stringify({ viewer: await box(p, ".file-viewer"), tabs: await all(p, ".changed-tabs button"), note: await all(p, ".changed-tabs-note"), heads: await all(p, ".changed-edit-head"), edits: await all(p, ".changed-edit"), title: await box(p, ".file-viewer-title") }));
  await p.locator(".changed-tabs button", { hasText: "Arquivo" }).click(); await p.locator(".file-viewer-text").waitFor(); await p.mouse.move(1400, 880); await shot(p, "d-file");
  console.log("file", JSON.stringify({ viewer: await box(p, ".file-viewer"), tabs: await all(p, ".changed-tabs button"), text: await box(p, ".file-viewer-text") }));
});
await br.close(); server.stop();
