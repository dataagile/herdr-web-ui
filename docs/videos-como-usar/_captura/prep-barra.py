# vídeo "Barra lateral": roda o prep-ptbr.py e acrescenta um segundo PC fictício na cópia da demo, para mostrar os Agentes dentro de cada PC
import copy, json, os, subprocess, sys
root = sys.argv[1]
subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "prep-ptbr.py"), root], check=True)
p = os.path.join(root, "site", "demo", "fixtures", "machines.json")
d = json.load(open(p))
src = d["machines"][0]["snapshot"]
# (workspace de origem, novo id, nome do projeto, título do agente, status)
NEW = [("w1C", "w2A", "app-mobile", "Tela de login no celular", "working"),
       ("w1D", "w2B", "relatorios", "Exportar relatório em PDF", "idle")]
snap = {k: v for k, v in src.items() if k not in ("workspaces", "tabs", "panes", "layouts", "agents")}
snap.update(workspaces=[], tabs=[], panes=[], layouts=[], agents=[])
ids = json.dumps
for old, new, label, title, status in NEW:
    def ren(o):  # troca o id do workspace em todo o objeto (ids de aba e de painel incluídos)
        return json.loads(ids(o).replace(f'"{old}', f'"{new}').replace(f'{old}:', f'{new}:'))
    w = ren(next(x for x in src["workspaces"] if x["workspace_id"] == old)); w.update(label=label, agent_status=status, focused=False)
    pane = ren(next(x for x in src["panes"] if x["workspace_id"] == old))
    pane.update(label=title, agent_status=status, focused=False, cwd=f"/home/dev/projetos/{label}", foreground_cwd=f"/home/dev/projetos/{label}")
    snap["workspaces"].append(w); snap["panes"].append(pane)
    snap["tabs"] += [ren(x) for x in src["tabs"] if x["workspace_id"] == old]
    snap["layouts"] += [ren(x) for x in src["layouts"] if x["workspace_id"] == old]
    snap["agents"] += [dict(ren(a), agent_status=status) for a in src["agents"] if a.get("pane_id") == f"{old}:p1"]
snap.update(focused_workspace_id="w2A", focused_tab_id="w2A:t1", focused_pane_id="w2A:p1")
d["machines"].append(dict(copy.deepcopy(d["machines"][0]), id="notebook", name="notebook", kind="ssh", snapshot=snap))
json.dump(d, open(p, "w"), ensure_ascii=False, indent=2)
print("barra ok")
