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
// 1000 de altura: os 5 agentes do pc-dev cabem acima do rodapé da barra
await ctx({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 }, async (p) => {
  const heads = () => all(p, "nav .sidebar-section-header, nav [aria-label^='Recolher'], nav [aria-label^='Expandir'], nav .agent-row, nav .needs-input-toggle");
  console.log("full", JSON.stringify(await heads()));
  await shot(p, "d-full");
  const pc = p.getByRole("button", { name: "Recolher pc-dev" });
  await pc.hover(); await shot(p, "d-pc-hover");
  await pc.click(); await p.waitForTimeout(600); await p.mouse.move(1100, 600); await shot(p, "d-pc-folded");
  console.log("folded", JSON.stringify(await heads()));
  const ag = p.locator("nav .sidebar-section-header", { hasText: "Agentes · 2" });
  await ag.hover(); await shot(p, "d-agents-hover");
  await ag.click(); await p.waitForTimeout(600); await p.mouse.move(1100, 600); await shot(p, "d-agents-folded");
  console.log("agents", JSON.stringify(await heads()));
});
await br.close(); server.stop();
