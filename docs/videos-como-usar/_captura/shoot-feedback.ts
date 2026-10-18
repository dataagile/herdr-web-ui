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
await ctx({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, async (p) => {
  await p.locator(".header-feedback").waitFor();
  console.log("btn", JSON.stringify({ fb: await box(p, ".header-feedback"), bell: await all(p, "header [aria-label=Alertas]") }));
  await shot(p, "d-full");
  await p.locator(".header-feedback").hover(); await shot(p, "d-fb-hover");
  await p.locator(".header-feedback").click(); await p.waitForTimeout(300);
  await shot(p, "d-fb-menu");
  console.log("menu", JSON.stringify(await all(p, "[role=menu], [role=menuitem]")));
  await p.getByRole("menuitem", { name: "Reportar erro" }).click(); await p.locator(".feedback-modal").waitFor();
  await p.mouse.move(1400, 880); await shot(p, "d-fb-form");
  console.log("form", JSON.stringify({ modal: await box(p, ".feedback-modal"), title: await all(p, ".feedback-modal .modal-title"), fields: await all(p, ".feedback-modal .field-label, .feedback-modal .btn, .feedback-check, .feedback-details summary, .feedback-modal textarea") }));
  await p.locator(".feedback-modal textarea").fill("O botão de exportar não responde quando o relatório tem mais de 100 linhas.");
  await shot(p, "d-fb-typed");
  await p.getByRole("button", { name: "Selecionar elemento na tela" }).click(); await p.waitForTimeout(600);
  await p.mouse.move(1100, 270); await shot(p, "d-fb-picker");
  console.log("picker", JSON.stringify({ hint: await all(p, ".picker-hint"), hl: await all(p, "[data-feedback-picker] *") }));
  await p.mouse.click(1100, 270); await p.locator(".feedback-thumb").waitFor({ timeout: 30000 });
  await p.mouse.move(1400, 880); await shot(p, "d-fb-attached");
  console.log("attached", JSON.stringify({ modal: await box(p, ".feedback-modal"), thumb: await box(p, ".feedback-thumb"), hints: await all(p, ".feedback-modal .field-hint"), fields: await all(p, ".feedback-modal .btn, .feedback-check") }));
  await p.locator(".feedback-modal button[type=submit]").scrollIntoViewIfNeeded(); await shot(p, "d-fb-attached-scrolled");
  console.log("submit", JSON.stringify({ submit: await all(p, ".feedback-modal button[type=submit]"), modal: await box(p, ".feedback-modal"), check: await all(p, ".feedback-check") }));
  await p.locator(".feedback-modal button[type=submit]").click(); await p.locator(".feedback-success").waitFor();
  await p.mouse.move(1400, 880); await shot(p, "d-fb-sent");
  console.log("sent", JSON.stringify({ modal: await box(p, ".feedback-modal"), texts: await all(p, ".feedback-success p, .feedback-success-icon, .modal-footer .btn") }));
});
await br.close(); server.stop();
