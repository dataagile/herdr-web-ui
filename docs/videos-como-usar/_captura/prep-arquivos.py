# vídeo "Arquivos": roda o prep.py e dá ao transporte demo (cópia temporária) uma pasta fictícia com arquivos
import os, subprocess, sys, json
root = sys.argv[1]
subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "prep.py"), root], check=True)
p = os.path.join(root, "site", "demo", "transport.ts")
s = open(p).read()

P = "/home/dev/projetos/infra"
MD = """# Backup noturno

O backup roda todo dia às **02:00** e guarda as cópias dos últimos **14 dias**.

## Passo a passo

1. Confira o espaço livre do disco de arquivo.
2. Rode o script de backup:

```bash
./scripts/backup.sh --manter 14
```

3. Veja o resultado em `relatorios/relatorio-backup.html`.

## Se falhar

- Confirme a regra de retenção das cópias.
- Abra um chamado para a equipe de infraestrutura.
"""
HTML = """<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório do backup</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#1d2433}h1{font-size:22px;margin:0 0 4px}p{color:#5b6475;margin:0 0 16px}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e3e6ec}
th{background:#f3f5f8}.ok{color:#11804f;font-weight:600}.erro{color:#b42318;font-weight:600}</style></head>
<body><h1>Relatório do backup</h1><p>Últimas 5 noites</p>
<table><tr><th>Noite</th><th>Duração</th><th>Situação</th></tr>
<tr><td>08/10</td><td>12 min</td><td class="ok">Concluído</td></tr>
<tr><td>07/10</td><td>—</td><td class="erro">Falhou: disco cheio</td></tr>
<tr><td>06/10</td><td>11 min</td><td class="ok">Concluído</td></tr>
<tr><td>05/10</td><td>12 min</td><td class="ok">Concluído</td></tr>
<tr><td>04/10</td><td>10 min</td><td class="ok">Concluído</td></tr></table>
<script>document.body.append("script rodou")</script></body></html>
"""
README = "# Infra\n\nScripts e configuração da infraestrutura do projeto.\n"
TEXT = {
    "README.md": README, "docs/backup-noturno.md": MD, "relatorios/relatorio-backup.html": HTML,
    "docs/arquitetura.md": "# Arquitetura\n", "scripts/backup.sh": "#!/bin/sh\n", "scripts/limpar-copias.sh": "#!/bin/sh\n",
    "terraform/main.tf": "", "terraform/variaveis.tf": "", "docker-compose.yml": "",
}
SIZES = {"terraform/main.tf": 2150, "terraform/variaveis.tf": 640, "docker-compose.yml": 1210}
tree = {}
for rel in TEXT:
    parts = rel.split("/")
    for i in range(len(parts)):
        d = "/".join([P] + parts[:i]); tree.setdefault(d, {"directories": set(), "files": []})
        if i < len(parts) - 1: tree[d]["directories"].add(parts[i])
        else: tree[d]["files"].append({"name": parts[i], "size": SIZES.get(rel, len(TEXT[rel].encode()))})
tree = {d: {"directories": sorted(v["directories"]), "files": sorted(v["files"], key=lambda f: f["name"])} for d, v in tree.items()}
texts = {f"{P}/{k}": v for k, v in TEXT.items()}

old_dir = s[s.index('  if (path === "/api/workspace/directories") {'):s.index('  if (path === "/api/workspace/create") {')]
new_dir = f'''  if (path === "/api/workspace/directories") {{
    if (method !== "GET") return error("demo", "Folders can't be created in the demo", 403);
    const dir = (query.get("path") || "/home/dev").replace(/\\/$/, "");
    const entry = (VIDEO_TREE as Record<string, {{ directories: string[]; files: {{ name: string; size: number }}[] }}>)[dir] ?? {{ directories: dir === "/home/dev" ? ["projetos"] : dir === "/home/dev/projetos" ? ["infra"] : [], files: [] }};
    return json({{ path: dir, parent: dir === "/" ? null : dir.replace(/\\/[^/]*$/, "") || "/", home: "/home/dev", ...entry, truncated: false }});
  }}
'''
s = s.replace(old_dir, new_dir)
old_fs = '  if (path.startsWith("/api/fs/")) return error("not_found", "the demo has no files to open", 404);'
new_fs = f'''  if (path === "/api/fs/stat" || path === "/api/fs/file") {{
    const asked = query.get("path") ?? "";
    const full = asked.startsWith("/") ? asked : "{P}/" + asked;
    const text = (VIDEO_TEXT as Record<string, string>)[full];
    if (text === undefined) return error("not_found", "no such file", 404);
    const name = full.split("/").pop()!;
    if (path === "/api/fs/file") return new Response(text, {{ headers: {{ "content-type": name.endsWith(".html") ? "text/html" : "text/plain" }} }});
    return json({{ path: full, name, size: new Blob([text]).size, modified: new Date().toISOString(), mime: name.endsWith(".html") ? "text/html" : "text/markdown", kind: "text" }});
  }}
{old_fs}'''
assert old_fs in s
s = s.replace(old_fs, new_fs)
s = s.replace("const DEMO_FILES = [", "const DEMO_FILES = " + json.dumps([k for k in TEXT]) + ";\nconst _OLD_DEMO_FILES = [", 1)
s += f"\nconst VIDEO_TREE = {json.dumps(tree)};\nconst VIDEO_TEXT = {json.dumps(texts)};\n"
open(p, "w").write(s)
print("arquivos ok")
