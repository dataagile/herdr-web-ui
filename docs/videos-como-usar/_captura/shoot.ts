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
  const p = await c.newPage(); p.on("pageerror", (e: any) => console.log("PAGEERROR", e.message));
  p.on("dialog", (d: any) => { console.log("DIALOG", d.message()); d.dismiss(); });
  await p.goto(url); await p.locator(".conn-live").waitFor({ state: "attached" }); await p.waitForTimeout(9000);
  await fn(p); await c.close();
}
const box = async (p: any, sel: string) => { if (!(await p.locator(sel).count())) return null; const b = await p.locator(sel).first().boundingBox({ timeout: 2000 }).catch(() => null); return b && [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 10) / 10); };
await ctx({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, async (p) => {
  console.log("desktop", JSON.stringify({ copy: await box(p, ".context-copy.in-crumb"), crumb: await box(p, ".context-sub"), title: await box(p, ".context-title"), copyTitle: await p.locator(".context-copy.in-crumb").getAttribute("title") }));
  await p.screenshot({ path: out + "d-full.png" });
  await p.locator(".context-copy.in-crumb").hover(); await p.waitForTimeout(400); await p.screenshot({ path: out + "d-copy-hover.png" });
  await p.locator(".context-copy.in-crumb").click(); await p.waitForTimeout(300);
  console.log("after", await p.locator(".context-copy.in-crumb").getAttribute("aria-label"), await p.evaluate(() => navigator.clipboard.readText()));
  await p.screenshot({ path: out + "d-copied.png" });
});
await ctx({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }, async (p) => {
  console.log("phone", JSON.stringify({ copy: await box(p, ".context-copy.in-title"), menu: await box(p, ".drawer-toggle"), tab: await box(p, ".tab-strip-tab") }));
  await p.screenshot({ path: out + "p-full.png" });
  await p.locator(".context-copy.in-title").tap(); await p.waitForTimeout(300);
  await p.screenshot({ path: out + "p-copied.png" });
  await p.waitForTimeout(2000);
  await p.locator(".drawer-toggle").tap(); await p.waitForTimeout(700);
  await p.screenshot({ path: out + "p-drawer.png" });
  console.log("drawer", JSON.stringify({ path: await box(p, ".drawer-path"), palette: await box(p, ".drawer-palette"), text: await p.locator(".drawer-path").textContent() }));
});
await br.close(); server.stop();
