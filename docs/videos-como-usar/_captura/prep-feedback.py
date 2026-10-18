# vídeo "Feedback": roda o prep.py e simula o portal na cópia da demo (feedback ligado; o envio responde 201 sem número, nada sai da máquina)
import os, subprocess, sys
root = sys.argv[1]
subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "prep.py"), root], check=True)
p = os.path.join(root, "site", "demo", "transport.ts")
s = open(p).read()
anchor = '  if (path === "/api/health") {'
assert anchor in s
s = s.replace(anchor, '''  if (path === "/api/portal/me") return json({ authenticated: true, feedback: { enabled: true, attachments: true } });
  if (path === "/api/portal/feedback") { await new Promise((r) => setTimeout(r, 400)); return json({ ticket_id: null, ticket_url: null }, 201); }
''' + anchor, 1)
open(p, "w").write(s)
print("feedback ok")
