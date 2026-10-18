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
  const p = await c.newPage(); p.setDefaultTimeout(30000); p.on("pageerror", (e: any) => console.log("PAGEERROR", e.message));
  p.on("dialog", (d: any) => { console.log("DIALOG", d.message()); d.dismiss(); });
  await p.goto(url); await p.locator(".conn-live").waitFor({ state: "attached" }); await p.waitForTimeout(9000);
  await fn(p); await c.close();
}
const box = async (p: any, sel: string) => { if (!(await p.locator(sel).count())) return null; const b = await p.locator(sel).first().boundingBox({ timeout: 2000 }).catch(() => null); return b && [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 10) / 10); };
const all = (p: any, sel: string) => p.evaluate((sel: string) => [...document.querySelectorAll(sel)].map((e) => { const b = e.getBoundingClientRect(); return [(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 70), [b.x, b.y, b.width, b.height].map(Math.round)]; }), sel);
const shot = async (p: any, n: string) => { await p.waitForTimeout(500); await p.screenshot({ path: out + n + ".png" }); console.log("shot", n); };
const side = async (p: any) => ({ sidebar: await all(p, "aside, .sidebar, nav.sidebar"), heads: await all(p, ".sidebar-section-header, .machine-header, .machine-row"), btns: await all(p, ".sidebar .icon-button, aside .icon-button, .sidebar-toggle, .sidebar-resizer, [role=separator]"), rows: await all(p, ".workspace-row, .agent-row") });
await ctx({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, async (p) => {
  console.log("full", JSON.stringify(await side(p)));
  await shot(p, "d-full");
  const row = p.locator(".workspace-row", { hasText: "Pagamentos" }).first();
  await row.hover(); await shot(p, "d-row-hover");
  console.log("hover", JSON.stringify(await all(p, ".workspace-row .icon-button")));
  await p.getByRole("button", { name: /^Mais para Pagamentos/ }).first().click(); await p.waitForTimeout(400); await shot(p, "d-row-menu");
  console.log("menu", JSON.stringify(await all(p, "[role=menu], [role=menuitem]")));
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  const sep = p.locator("[role=separator]").first(); const b = await sep.boundingBox();
  await p.mouse.move(b.x + b.width / 2, 450); await shot(p, "d-resize-hover");
  await p.mouse.down(); await p.mouse.move(b.x + 80, 450, { steps: 10 }); await p.mouse.up(); await p.mouse.move(1100, 600); await shot(p, "d-wide");
  console.log("wide", JSON.stringify(await side(p)));
  await p.locator(".sidebar-toggle").hover(); await shot(p, "d-toggle-hover");
  await p.locator(".sidebar-toggle").click(); await p.waitForTimeout(600); await p.mouse.move(1100, 600); await shot(p, "d-collapsed");
  console.log("collapsed", JSON.stringify({ toggle: await all(p, ".sidebar-toggle") }));
});
await br.close(); server.stop();
