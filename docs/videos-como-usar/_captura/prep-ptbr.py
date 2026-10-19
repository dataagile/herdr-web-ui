# vídeos 5 a 7: roda o prep.py e traduz para pt-BR as conversas e a pergunta da demo (cópia temporária)
import os, re, subprocess, sys
root = sys.argv[1]
subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "prep.py"), root], check=True)
p = os.path.join(root, "site", "demo", "fixtures.ts")
s = open(p).read()
R = [
    ("Make `POST /payments` idempotent: a client retrying with the same `Idempotency-Key` must get the first response back, never a second charge. Cover it with tests.",
     "Faça o `POST /payments` não cobrar duas vezes: quem repetir o pedido com a mesma chave recebe a primeira resposta. Cubra com testes."),
    ("I'll look at how payments are created and where a key could be stored.", "Vou ver como os pagamentos são criados e onde guardar a chave."),
    ("Nice. Now add a metric for replayed requests.", "Ótimo. Agora crie uma métrica para os pedidos repetidos."),
    ("Adding a `payments_idempotent_replays_total` counter next to the existing request metrics.", "Criando o contador `pagamentos_repetidos_total` junto das métricas de pedidos."),
    ("Rate-limit the export button so a double click can't start two exports, then push the branch.",
     "Proteja o botão de exportar para um clique duplo não iniciar duas exportações e depois envie a branch."),
    ("The button is disabled while an export runs, and a second click within the same run is ignored. Tests pass; I need your OK to push `feat/export-guard`.",
     "O botão fica desativado enquanto a exportação roda, e um segundo clique é ignorado. Os testes passam; preciso do seu ok para enviar `feat/export-guard`."),
    ('"Allow command?"', '"Permitir o comando?"'),
    ('label: "Yes"', 'label: "Sim"'),
    ("Yes, and don't ask again for git push", "Sim, e não perguntar de novo para git push"),
    ("No, and tell Codex what to do differently", "Não, e dizer ao Codex o que fazer diferente"),
]
for a, b in R:
    assert a in s, a[:40]
    s = s.replace(a, b)
# a resposta longa do painel de pagamentos
s, n = re.subn(r'text: "Done\. Retries are now safe:[^"]*"', 'text: "Pronto. Repetir o pedido agora é seguro:\\\\n\\\\n- **`src/lib/idempotency.ts`** guarda a primeira resposta de cada chave por 24 h.\\\\n- **`POST /payments`** devolve a resposta guardada quando a chave se repete.\\\\n\\\\nTestes: 14 passaram, inclusive pedidos repetidos ao mesmo tempo."', s)
assert n == 1
open(p, "w").write(s)
# a resposta que chega 4,5 s depois de abrir a demo (transport.ts)
p = os.path.join(root, "site", "demo", "transport.ts")
s = open(p).read()
a = "Added `payments_idempotent_replays_total`, incremented where a stored response is replayed, and exposed with the other counters on `/metrics`. 6 tests pass."
assert a in s
open(p, "w").write(s.replace(a, "Criei o contador `pagamentos_repetidos_total`: ele soma cada resposta guardada que é devolvida e aparece com os outros em `/metrics`. 6 testes passaram."))
print("ptbr ok")
