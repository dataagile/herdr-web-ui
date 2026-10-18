// serve docs/videos-como-usar with HTTP range support (iOS Safari needs it)
const root = new URL("..", import.meta.url).pathname;
Bun.serve({ hostname: "127.0.0.1", port: 8318, fetch(req) {
  const p = decodeURIComponent(new URL(req.url).pathname).replace(/\.\./g, "");
  const f = Bun.file(root + p);
  return f.size ? new Response(f) : new Response("not found", { status: 404 });
}});
