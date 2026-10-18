# copia site/demo para um diretório temporário com textos fictícios em pt-BR (o repo não muda)
import os, shutil, sys
repo = os.environ.get("DEVDA_REPO") or os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))  # raiz do fork
root = sys.argv[1]
os.makedirs(os.path.join(root, "site"), exist_ok=True)
dst = os.path.join(root, "site", "demo")
shutil.copytree(os.path.join(repo, "site", "demo"), dst, dirs_exist_ok=True)
for name in ("shared", "src", "node_modules", "package.json", "tsconfig.json"):
    link = os.path.join(root, name)
    if not os.path.lexists(link): os.symlink(os.path.join(repo, name), link)
R = [
    ("/tmp/devda-demo/", "/home/dev/projetos/"),
    ('"name": "workstation"', '"name": "pc-dev"'),
    ("Idempotent payments", "Pagamentos sem duplicidade"),
    ("Guard the export button", "Proteger o botão de exportar"),
    ("Why did the backup fail?", "Por que o backup falhou?"),
    ("Proofread the guide", "Revisar o guia"),
    ("Tag v1.4.0", "Gerar a versão 1.4.0"),
    ("Ship the retry flag", "Publicar a nova tentativa"),
    ("Why did last night's backup job fail?", "Por que o backup de ontem à noite falhou?"),
    ("The archive volume hit its quota at 02:14. Old snapshots were never pruned because the retention flag was dropped in the last config change. I restored `--keep-daily 14`; tonight's run will prune and succeed.",
     "O disco de arquivo encheu às 02:14. As cópias antigas não eram apagadas porque a regra de retenção sumiu na última mudança de configuração. Restaurei a regra; o backup desta noite vai limpar o disco e concluir."),
]
for dirpath, _, files in os.walk(dst):
    for f in files:
        if not f.endswith((".json", ".ts")): continue
        p = os.path.join(dirpath, f); s = open(p).read(); o = s
        for a, b in R: s = s.replace(a, b)
        if s != o: open(p, "w").write(s)
print("ok", dst)
