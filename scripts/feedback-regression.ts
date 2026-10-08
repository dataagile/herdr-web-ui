import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page, type Request } from "playwright-core";
import { appFaces } from "./app-faces.ts";
import panes from "../site/demo/fixtures/panes.json";

// The header's feedback button, on the unmodified app over the demo's fixture transport. The demo
// answers every /api/* itself, so the portal's /api/portal/* is let through to the network here
// and Playwright answers it: `me` (is there a portal, is feedback on) and the POST. Nothing leaves
// this disposable loopback app. FEEDBACK_SHOTS=<dir> also saves a screenshot of each state and
// the print the picker made.
const repo = join(import.meta.dir, "..");
const app = mkdtempSync(join(tmpdir(), "herdr-feedback-"));
const shots = process.env.FEEDBACK_SHOTS ?? null;
const SECRET = "SEEDSECRET123";
const EMAIL = "bob@example.com";
const QUERY = "SEEDQUERY456";

type Me = unknown;
const ME_ON: Me = { authenticated: true, feedback: { enabled: true, attachments: true } };

/** the multipart body of a request, as the portal would read it */
async function formOf(request: Request): Promise<FormData> {
  return new Response(request.postDataBuffer()!, { headers: { "content-type": request.headers()["content-type"]! } }).formData();
}

try {
  const build = Bun.spawnSync([join(repo, "node_modules/.bin/vite"), "build", "--base", "./", "--outDir", app, "--emptyOutDir", "--logLevel", "warn"], { cwd: repo });
  assert.equal(build.exitCode, 0, new TextDecoder().decode(build.stderr));
  const transport = await Bun.build({
    entrypoints: [join(repo, "site/demo/transport.ts")], outdir: app, naming: "demo-transport.js", target: "browser",
    define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(join(repo, "package.json"), "utf8")).version) },
  });
  assert.ok(transport.success, transport.logs.map(String).join("\n"));
  const index = join(app, "index.html");
  const html = readFileSync(index, "utf8");
  assert.match(html, /<script type="module"/);
  writeFileSync(index, html.replace(/<script type="module"/, () => `<script>window.netFetch = window.fetch.bind(window);</script>
    <script src="./demo-transport.js"></script>
    <script>(() => {
      const demo = window.fetch;
      window.fetch = (input, init) => {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
        return url.pathname.startsWith("/api/portal/") ? window.netFetch(input, init) : demo(input, init);
      };
    })();</script>
    <script type="module"`));

  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith("/herdr-web-ui/demo/app/")) return new Response("not found", { status: 404 });
    let file: string;
    try { file = decodeURIComponent(path.slice("/herdr-web-ui/demo/app/".length)); }
    catch { return new Response("bad path", { status: 400 }); }
    if (!file || file.endsWith("/")) file += "index.html";
    if (file.split("/").includes("..") || file.includes("\\")) return new Response("bad path", { status: 400 });
    const body = Bun.file(join(app, file));
    return (await body.exists()) ? new Response(body) : new Response("not found", { status: 404 });
  } });
  const url = `http://127.0.0.1:${server.port}/herdr-web-ui/demo/app/?pane=${encodeURIComponent(panes.web)}`;
  if (shots !== null) mkdirSync(shots, { recursive: true });

  try {
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/google/chrome/chrome", headless: true, args: ["--no-sandbox"] });
    try {
      interface Opened { page: Page; context: BrowserContext; errors: string[]; posts: Request[]; answer: { status: number; body?: unknown }; shot: (name: string) => Promise<void>; close: () => Promise<void> }
      const open = async ({ width, height, touch = false, me = ME_ON, status = 200 }: { width: number; height: number; touch?: boolean; me?: Me; status?: number }): Promise<Opened> => {
        const context = await browser.newContext({ viewport: { width, height }, locale: "en-US", hasTouch: touch, isMobile: touch });
        await context.addInitScript(() => localStorage.setItem("herdr-web-ui:settings", JSON.stringify({ language: "en" })));
        const page = await context.newPage();
        const errors: string[] = [];
        const posts: Request[] = [];
        const answer: Opened["answer"] = { status: 201, body: { ticket_id: 1234, ticket_url: "https://suporte.example/chamado/1234" } };
        page.on("pageerror", (error) => errors.push(error.message));
        if (process.env.FEEDBACK_DEBUG) page.on("console", (message) => console.log("console:", message.text()));
        await page.route("**/api/portal/me", (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(me) }));
        await page.route("**/api/portal/feedback", (route) => {
          posts.push(route.request());
          return route.fulfill({ status: answer.status, contentType: "application/json", body: JSON.stringify(answer.body ?? {}) });
        });
        await page.goto(url);
        await page.locator(".conn-live").waitFor({ state: "attached" });
        await page.locator(".header-files").waitFor();
        await appFaces(page);
        return { page, context, errors, posts, answer, close: () => context.close(), shot: async (name) => { if (shots !== null) await page.screenshot({ path: join(shots, `${name}.png`) }); } };
      };
      const button = (page: Page) => page.getByRole("button", { name: "Send feedback" });
      const dialog = (page: Page) => page.getByRole("dialog");

      // 1. hidden unless the portal is there and says feedback is on
      for (const [name, me, status] of [
        ["feedback disabled", { authenticated: true, feedback: { enabled: false, attachments: true } }, 200],
        ["no feedback field (a portal that predates it)", { authenticated: true }, 200],
        ["no portal (this app's own 404)", { error: { code: "not_found" } }, 404],
        ["not signed in", { authenticated: false, feedback: { enabled: true, attachments: true } }, 200],
      ] as const) {
        const { page, errors, close } = await open({ width: 1440, height: 900, me, status });
        try {
          await page.waitForTimeout(400);
          assert.equal(await button(page).count(), 0, `${name}: no feedback button`);
          assert.deepEqual(errors, []);
        } finally { await close(); }
      }
      console.log("PASS the button is absent without a portal, without feedback on, or with a portal that does not say");

      // 2. the whole flow on a desktop
      {
        const { page, posts, answer, errors, shot, close } = await open({ width: 1440, height: 900 });
        try {
          // something for the technical data to mask: a console line and a failed request
          await page.evaluate(([secret, email, query]) => {
            console.error(`login failed token=${secret} for ${email}`);
            void fetch(`/api/does-not-exist?session=${query}`);
          }, [SECRET, EMAIL, QUERY] as const);
          await page.waitForTimeout(300);

          const trigger = button(page);
          await trigger.waitFor();
          const order = await page.evaluate(() => {
            const feedback = document.querySelector(".header-feedback")!;
            return { before: feedback.nextElementSibling?.classList.contains("header-bell") ?? false, inBell: feedback.closest(".header-bell") !== null };
          });
          assert.deepEqual(order, { before: true, inBell: false }, "the megaphone sits just before the bell, outside it");
          assert.equal(await trigger.getAttribute("title"), "Send feedback");
          await trigger.click();
          assert.equal(await trigger.getAttribute("aria-expanded"), "true");
          assert.deepEqual(await page.getByRole("menuitem").allTextContents(), ["Report a bug", "Suggest an improvement", "General feedback"]);
          await shot("1-header-menu");
          await page.getByRole("menuitem", { name: "Report a bug" }).click();

          const modal = dialog(page);
          await modal.waitFor();
          assert.equal(await modal.locator(".modal-title").textContent(), "Report a bug");
          const send = modal.getByRole("button", { name: "Send", exact: true });
          assert.equal(await send.isDisabled(), true, "no description, no send");
          const message = modal.getByLabel("Description (required)");
          await message.fill("   ");
          assert.equal(await send.isDisabled(), true, "blanks are no description");
          await message.fill("Split hides the Files button and the bar flickers.");
          assert.equal(await send.isDisabled(), false);

          // a file that is not an image, then one over 10 MB, are refused in the form
          const chooser = modal.locator('input[type="file"]');
          await chooser.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
          await modal.getByRole("alert").waitFor();
          assert.equal(await modal.locator(".feedback-thumb").count(), 0);
          await chooser.setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
          assert.match((await modal.getByRole("alert").textContent()) ?? "", /up to 10 MB/);

          // the preview is the masked data
          await modal.getByText("See what will be sent").click();
          const preview = (await modal.locator(".feedback-json").textContent()) ?? "";
          assert.ok(preview.includes('"tech_context"'), preview);
          assert.ok(preview.includes("[TOKEN]") && preview.includes("[EMAIL]"), `the console line is masked in the preview:\n${preview}`);
          for (const leak of [SECRET, EMAIL, QUERY]) assert.ok(!preview.includes(leak), `${leak} is not in the preview`);
          assert.ok(preview.includes('"path": "/api/does-not-exist?session=[Q]"'), preview);
          await shot("2-dialog");

          // the picker: Escape gives the form back as it was
          await modal.getByRole("button", { name: "Select element on screen" }).click();
          await page.locator(".picker-layer").waitFor();
          assert.equal(await dialog(page).count(), 0, "the form is out of the print");
          await shot("3-picker");
          await page.keyboard.press("Escape");
          await page.locator(".picker-layer").waitFor({ state: "detached" });
          await dialog(page).waitFor();
          assert.equal(await modal.getByLabel("Description (required)").inputValue(), "Split hides the Files button and the bar flickers.");

          // a click selects the element under the pointer
          await modal.getByRole("button", { name: "Select element on screen" }).click();
          await page.locator(".picker-layer").waitFor();
          const files = await page.locator(".header-files").boundingBox();
          assert.ok(files);
          await page.mouse.move(files.x + 2, files.y + files.height / 2); // the button's own padding, not its label
          await page.locator(".picker-target-tag").waitFor();
          assert.equal(await page.locator(".picker-target-tag").textContent(), "button.btn");
          await page.mouse.down();
          await page.mouse.up();
          await page.locator(".feedback-thumb img").waitFor();
          const pixels = await page.locator(".feedback-thumb img").evaluate(async (node: HTMLImageElement) => {
            await node.decode();
            const canvas = document.createElement("canvas");
            canvas.width = node.naturalWidth; canvas.height = node.naturalHeight;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(node, 0, 0);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            const seen = new Set<number>();
            for (let at = 0; at < data.length; at += 4) seen.add((data[at]! << 16) | (data[at + 1]! << 8) | data[at + 2]!);
            return { width: node.naturalWidth, height: node.naturalHeight, colours: seen.size };
          });
          assert.ok(pixels.width >= 1440 && pixels.height >= 900 && pixels.colours > 20, `the print is the window, not a blank: ${JSON.stringify(pixels)}`);
          assert.equal(await page.locator(".picker-layer").count(), 0);
          assert.equal(await modal.getByLabel("Description (required)").inputValue(), "Split hides the Files button and the bar flickers.", "the text survived the picker");
          assert.match((await modal.textContent()) ?? "", /Element selected: button\.btn/);
          assert.equal(await modal.getByRole("button", { name: "Select element on screen" }).count(), 0, "Redo replaces the picker button");
          assert.ok((await modal.locator(".feedback-json").textContent())!.includes('"element_context"'), "the preview now shows what was pointed at");
          await shot("4-thumbnail");
          if (shots !== null) {
            const bytes = await page.locator(".feedback-thumb img").evaluate(async (node: HTMLImageElement) => Array.from(new Uint8Array(await (await fetch(node.src)).arrayBuffer())));
            writeFileSync(join(shots, "captured-print.png"), Buffer.from(bytes));
          }

          // Redo, by dragging an area
          await modal.getByRole("button", { name: "Redo" }).click();
          await page.locator(".picker-layer").waitFor();
          await page.mouse.move(400, 300);
          await page.mouse.down();
          await page.mouse.move(700, 500, { steps: 5 });
          await page.mouse.up();
          await page.locator(".feedback-thumb img").waitFor();
          assert.match((await modal.textContent()) ?? "", /Area selected on the screen/);
          assert.equal(await page.locator(".picker-layer").count(), 0);

          // sending: the portal gets a multipart form whose technical data is masked
          await modal.getByRole("button", { name: "Send", exact: true }).click();
          await page.getByText("Ticket #1234 opened").waitFor();
          assert.equal(posts.length, 1);
          const post = posts[0]!;
          assert.equal(post.method(), "POST");
          assert.match(post.headers()["content-type"] ?? "", /^multipart\/form-data; boundary=/);
          const form = await formOf(post);
          assert.equal(form.get("category"), "erro");
          assert.equal(form.get("message"), "Split hides the Files button and the bar flickers.");
          assert.match(String(form.get("route")), /^\//);
          const attachment = form.get("attachment") as File;
          assert.ok(attachment.size > 1000 && /^image\/(png|jpeg)$/.test(attachment.type), `${attachment.name} ${attachment.type} ${attachment.size}`);
          const tech = String(form.get("tech_context"));
          for (const leak of [SECRET, EMAIL, QUERY]) assert.ok(!tech.includes(leak), `tech_context carries no ${leak}`);
          assert.ok(!String(form.get("element_context")).includes(SECRET));
          const parsed = JSON.parse(tech);
          assert.equal(parsed.version, 1);
          assert.ok(parsed.console_errors.some((line: { level: string; message: string }) => line.level === "error" && line.message.includes("[TOKEN]") && line.message.includes("[EMAIL]")), tech);
          assert.deepEqual(parsed.failed_requests.at(-1), { method: "GET", path: "/api/does-not-exist?session=[Q]", status: 404 });
          assert.deepEqual(Object.keys(parsed).sort(), ["captured_at", "console_errors", "failed_requests", "herdr_version", "lang", "machine", "pane_agent", "ui_revision", "url", "user_agent", "version", "viewport"]);
          assert.equal(JSON.parse(String(form.get("element_context"))).modo, "area");
          assert.ok(new TextEncoder().encode(tech).length <= 200_000);
          const link = page.getByRole("link", { name: "Open in support" });
          assert.equal(await link.getAttribute("href"), "https://suporte.example/chamado/1234");
          assert.deepEqual(await modal.getByRole("button", { name: /^(Close|Send|Cancel)$/ }).allTextContents(), ["Close"]);
          await shot("5-success");
          await modal.getByRole("button", { name: "Close", exact: true }).last().click();
          await dialog(page).waitFor({ state: "detached" });
          await page.waitForFunction(() => document.activeElement?.classList.contains("header-feedback") === true, undefined, { timeout: 3000 }); // the focus goes back to the megaphone

          // the checkbox off: no technical data leaves; a 429 keeps the form and says so
          answer.status = 429; answer.body = { error: "rate" };
          await button(page).click();
          await page.getByRole("menuitem", { name: "General feedback" }).click();
          await modal.getByLabel("Description (required)").fill("Just a thought.");
          await modal.getByLabel("Include technical data in the ticket").uncheck();
          await modal.getByRole("button", { name: "Send", exact: true }).click();
          await modal.getByRole("alert").waitFor();
          assert.equal(await modal.getByRole("alert").textContent(), "Too many submissions. Try again in a few minutes.");
          assert.equal(await modal.getByLabel("Description (required)").inputValue(), "Just a thought.");
          assert.equal(await modal.getByRole("button", { name: "Send", exact: true }).isEnabled(), true, "it can be tried again");
          const second = await formOf(posts[1]!);
          assert.equal(second.get("category"), "feedback");
          assert.equal(second.has("tech_context"), false, "unchecked, no technical data");
          assert.equal(second.has("attachment"), false);
          await shot("6-error-429");
          answer.status = 413;
          await modal.getByRole("button", { name: "Send", exact: true }).click();
          await page.getByText("Image too large (max. 10 MB).").waitFor();
          answer.status = 503;
          await modal.getByRole("button", { name: "Send", exact: true }).click();
          await page.getByText("Feedback is unavailable right now.").waitFor();
          answer.status = 500;
          await modal.getByRole("button", { name: "Send", exact: true }).click();
          await page.getByText("Could not open the ticket. Try again.").waitFor();
          answer.status = 201; answer.body = { ticket_id: 1234, ticket_url: "https://suporte.example/chamado/1234" };
          await modal.getByRole("button", { name: "Send", exact: true }).click();
          await page.getByText("Ticket #1234 opened").waitFor();
          assert.deepEqual(errors, []);
        } finally { await close(); }
      }
      console.log("PASS menu, form, picker (click, drag, Escape), masked multipart send, success, 429/413/503/500 and the unchecked box");

      // 3. attachments off: a form without the image field or the technical data
      {
        const { page, errors, close } = await open({ width: 1440, height: 900, me: { authenticated: true, feedback: { enabled: true, attachments: false } } });
        try {
          await button(page).click();
          await page.getByRole("menuitem", { name: "Suggest an improvement" }).click();
          const modal = dialog(page);
          await modal.waitFor();
          assert.equal(await modal.getByText("Image (optional, up to 10 MB)").count(), 0);
          assert.equal(await modal.getByLabel("Include technical data in the ticket").count(), 0);
          assert.deepEqual(errors, []);
        } finally { await close(); }
      }
      console.log("PASS without attachments the form is only the description");

      // 4. a phone: icons only, a sheet for the menu, no picker and no technical data
      {
        const { page, errors, shot, close } = await open({ width: 360, height: 740, touch: true });
        try {
          const trigger = button(page);
          await trigger.waitFor();
          const fit = await page.evaluate(() => {
            const header = document.querySelector<HTMLElement>(".app-header")!;
            const feedback = document.querySelector<HTMLElement>(".header-feedback")!.getBoundingClientRect();
            const drawer = document.querySelector<HTMLElement>(".drawer-toggle")!.getBoundingClientRect();
            const children = [...header.children].map((node) => node.getBoundingClientRect());
            return {
              pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
              headerOverflow: header.scrollWidth - header.clientWidth,
              rightmost: Math.max(...children.map((rect) => rect.right)),
              window: window.innerWidth,
              size: [feedback.width, feedback.height],
              reference: [drawer.width, drawer.height],
              overlap: children.some((a, i) => children.some((b, j) => j > i && a.width > 0 && b.width > 0 && a.right - 0.5 > b.left && a.left < b.right - 0.5 && a.top < b.bottom && b.top < a.bottom)),
            };
          });
          console.log("phone header fit:", JSON.stringify(fit));
          assert.ok(fit.pageOverflow <= 0 && fit.headerOverflow <= 0, `no horizontal overflow at 360px: ${JSON.stringify(fit)}`);
          assert.ok(fit.rightmost <= fit.window + 0.5, "the header ends inside the window");
          assert.equal(fit.overlap, false, "the header controls do not overlap");
          assert.deepEqual(fit.size, fit.reference, "the megaphone is as big as the header's other icon buttons (the touch target)");
          await shot("7-phone-header");
          await trigger.tap();
          await page.locator(".row-sheet").waitFor();
          assert.deepEqual(await page.locator(".row-sheet-item").allTextContents(), ["Report a bug", "Suggest an improvement", "General feedback"]);
          await shot("8-phone-sheet");
          await page.locator(".row-sheet-item").first().tap();
          const modal = dialog(page);
          await modal.waitFor();
          assert.equal(await modal.getByRole("button", { name: "Choose image" }).count(), 1, "an image can still be chosen");
          assert.equal(await modal.getByRole("button", { name: "Select element on screen" }).count(), 0, "no picker under 1024px");
          assert.equal(await modal.getByLabel("Include technical data in the ticket").count(), 0, "no technical data under 1024px");
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0);
          await shot("9-phone-dialog");
          assert.deepEqual(errors, []);
        } finally { await close(); }
      }
      console.log("PASS on a 360px phone the header fits with the megaphone, the menu is a sheet, and the picker and technical data are absent");
    } finally { await browser.close(); }
  } finally { server.stop(); }
} finally { rmSync(app, { recursive: true, force: true }); }
