# vídeo "Arquivos modificados": roda o prep-arquivos.py e troca os arquivos modificados da demo por fictícios em pt-BR (cópia temporária)
import os, subprocess, sys, json
root = sys.argv[1]
subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "prep-arquivos.py"), root], check=True)
p = os.path.join(root, "site", "demo", "transport.ts")
s = open(p).read()

P = "/home/dev/projetos/infra"
BACKUP = """#!/bin/sh
# backup noturno do disco de arquivo
set -e
echo "início do backup: $(date)"
restic backup /srv/arquivo
restic forget --manter-diarios 14 --prune
echo "backup concluído"
"""
old = '"/home/dev/projetos/infra/scripts/backup.sh": "#!/bin/sh\\n"'
assert old in s, "backup.sh"
s = s.replace(old, json.dumps(f"{P}/scripts/backup.sh") + ": " + json.dumps(BACKUP))

a = s.index('  if (path === "/api/pane/changed-files") {')
b = s.index('  if (path === "/api/pane/prompt")')
session = [
    {"path": f"{P}/scripts/backup.sh", "rel": "scripts/backup.sh", "exists": True, "edits": 2, "created": False, "last_at": "2026-10-09T05:42:00.000Z", "git": "M"},
    {"path": f"{P}/docs/backup-noturno.md", "rel": "docs/backup-noturno.md", "exists": True, "edits": 1, "created": True, "last_at": "2026-10-09T05:38:00.000Z", "git": "?"},
    {"path": f"{P}/README.md", "rel": "README.md", "exists": True, "edits": 1, "created": False, "last_at": "2026-10-09T05:31:00.000Z", "git": "M"},
]
git = [{"path": f"{P}/terraform/variaveis.tf", "rel": "terraform/variaveis.tf", "exists": True, "git": "M"}]
diffs = {
    "backup.sh": {"kind": "session", "edits": [
        {"at": "2026-10-09T05:35:00.000Z", "body": {"kind": "replace", "edits": [{"before": "restic forget --prune", "after": "restic forget --manter-diarios 14 --prune"}]}},
        {"at": "2026-10-09T05:42:00.000Z", "body": {"kind": "replace", "edits": [{"before": "restic backup /srv/arquivo", "after": "echo \"início do backup: $(date)\"\nrestic backup /srv/arquivo"}]}},
    ]},
    "backup-noturno.md": {"kind": "session", "edits": [{"at": "2026-10-09T05:38:00.000Z", "body": {"kind": "write", "content": "# Backup noturno\n\nO backup roda todo dia às 02:00 e guarda as cópias dos últimos 14 dias.\n"}}]},
    "README.md": {"kind": "session", "edits": [{"at": "2026-10-09T05:31:00.000Z", "body": {"kind": "replace", "edits": [{"before": "# Infra", "after": "# Infra\n\nScripts e configuração da infraestrutura do projeto."}]}}]},
    "variaveis.tf": {"kind": "git", "diff": "diff --git a/terraform/variaveis.tf b/terraform/variaveis.tf\n@@ -1,3 +1,3 @@\n variable \"tamanho_disco\" {\n-  default = 100\n+  default = 200\n }\n", "truncated": False},
}
new = f'''  if (path === "/api/pane/changed-files") {{
    const edited = keyOfPane.has(paneId) && chats.has(keyOfPane.get(paneId)!);
    return json({{ session: edited ? {json.dumps(session)} : [], git: edited ? {json.dumps(git)} : [], repo: edited }}, 200, {{ "cache-control": "no-store" }});
  }}
  if (path === "/api/pane/changed-files/diff") {{
    const file = query.get("path") ?? "";
    const d = ({json.dumps(diffs)} as Record<string, object>)[file.split("/").pop()!];
    return d ? json({{ path: file, ...d }}) : error("not_found", "no such file", 404);
  }}
'''
s = s[:a] + new + s[b:]
open(p, "w").write(s)
print("modificados ok")
