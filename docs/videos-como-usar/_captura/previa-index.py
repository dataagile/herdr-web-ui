# gera previa/index.html (quadros + roteiro.md) para <slug>
import os, sys, html
slug = sys.argv[1]; title = sys.argv[2]
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", slug)
md = open(d + "/roteiro.md").read()
imgs = "".join(f'<figure><img src="{f}" loading="lazy"><figcaption>{f[1:-4].lstrip("0")} s</figcaption></figure>' for f in sorted(os.listdir(d + "/previa")) if f.endswith(".png"))
open(d + "/previa/index.html", "w").write(f'''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prévia · {slug}</title>
<style>body{{background:#0b1512;color:#e6ece9;font:16px system-ui;margin:16px}}.g{{display:flex;flex-wrap:wrap;gap:12px}}figure{{margin:0;width:min(270px,100%)}}img{{width:100%;border-radius:8px}}figcaption{{text-align:center;color:#8aa}}pre{{white-space:pre-wrap;background:#13201c;padding:12px;border-radius:8px;font-size:13px}}</style>
<h1>Prévia: {html.escape(title)}</h1><div class="g">{imgs}</div><h2>Roteiro</h2><pre>{html.escape(md)}</pre>''')
print("ok", slug)
