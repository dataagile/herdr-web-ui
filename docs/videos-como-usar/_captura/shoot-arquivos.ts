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
const rows = (p: any) => p.evaluate(() => Object.fromEntries([...document.querySelectorAll("[role=treeitem]")].map((e) => { const b = e.getBoundingClientRect(); return [e.getAttribute("data-path"), [b.x, b.y, b.width, b.height].map(Math.round)]; })));
const shot = async (p: any, n: string) => { await p.waitForTimeout(500); await p.screenshot({ path: out + n + ".png" }); };
await ctx({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }, async (p) => {
  console.log("files-btn", JSON.stringify(await box(p, ".header-files")), await p.locator(".header-files").getAttribute("title"));
  await shot(p, "d-full");
  await p.locator(".header-files").hover(); await shot(p, "d-files-hover");
  await p.locator(".header-files").click(); await p.locator("[role=treeitem]").first().waitFor();
  await shot(p, "d-tree");
  console.log("tree", JSON.stringify({ dialog: await box(p, ".files-dialog"), filter: await box(p, ".dir-browser-filter"), path: await box(p, ".dir-browser-path"), rows: await rows(p) }));
  await p.locator('[role=treeitem][data-path$="/infra/docs"]').hover(); await shot(p, "d-tree-hover");
  await p.locator('[role=treeitem][data-path$="/infra/docs"]').click(); await p.locator('[data-path$="backup-noturno.md"]').waitFor();
  await p.mouse.move(1300, 850); await shot(p, "d-tree-docs");
  console.log("docs", JSON.stringify(await rows(p)));
  await p.locator(".dir-browser-filter input").click();
  await p.keyboard.type("bac"); await shot(p, "d-filter-bac");
  await p.keyboard.type("kup"); await p.locator('[data-path$="relatorio-backup.html"]').waitFor(); await shot(p, "d-filter");
  console.log("filter", JSON.stringify({ input: await box(p, ".dir-browser-filter input"), scope: await box(p, ".dir-browser-scope"), scopeText: await p.locator(".dir-browser-scope").textContent(), rows: await rows(p) }));
  await p.locator('[role=treeitem][data-path$="backup-noturno.md"]').click(); await p.locator(".file-viewer-render").waitFor(); await shot(p, "d-md");
  console.log("md", JSON.stringify({ viewer: await box(p, ".file-viewer"), seg: await box(p, ".file-viewer-toolbar .segmented"), view: await box(p, ".file-viewer-toolbar .segmented button:nth-child(1)"), code: await box(p, ".file-viewer-toolbar .segmented button:nth-child(2)"), title: await box(p, ".file-viewer-title"), labels: await p.locator(".file-viewer-toolbar .segmented button").allTextContents() }));
  await p.locator(".file-viewer-toolbar .segmented button:nth-child(2)").click(); await p.locator(".file-viewer-text").waitFor(); await shot(p, "d-md-code");
  console.log("edit", JSON.stringify(await box(p, ".file-viewer-editbar .btn")), await p.locator(".file-viewer-editbar .btn").textContent());
  await p.keyboard.press("Escape"); await p.locator(".file-viewer").waitFor({ state: "detached" });
  await p.locator('[role=treeitem][data-path$="relatorio-backup.html"]').click(); await p.locator(".file-viewer-html").waitFor(); await p.waitForTimeout(800); await shot(p, "d-html");
  console.log("html", JSON.stringify({ viewer: await box(p, ".file-viewer"), sandbox: await box(p, ".file-viewer-sandbox"), sandboxText: await p.locator(".file-viewer-sandbox").textContent(), frame: await box(p, ".file-viewer-html"), view: await box(p, ".file-viewer-toolbar .segmented button:nth-child(1)") }));
});
await br.close(); server.stop();
