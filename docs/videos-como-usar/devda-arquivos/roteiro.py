"""Arquivos do projeto: árvore, filtro e .md/.html formatados (série "Veja em ação" do DevDA, vídeo 2). 9:16, sem áudio.

Prints da sessão de demonstração com textos e pasta fictícios em pt-BR (em prints/):
desktop 1440x900 @2x (2880x1800). Alvos em pixels do print (CSS x2), medidos pelo Playwright.
"""
import os
import engine as E  # antes do skia
import skia
import kit as K

FORMAT, DURATION, POSTER_T = "9:16", 55.0, 2.6
W, H = E.size(FORMAT)
HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = ("d-full", "d-files-hover", "d-tree", "d-tree-hover", "d-tree-docs", "d-filter-bac", "d-filter", "d-md", "d-md-code", "d-html")
IMG = {k: E.load_image(os.path.join(HERE, "prints", f"{k}.png"), 2880, 3840) for k in NAMES}

# ---------- grade 9:16: margem 65; área segura topo 220, base 320, direita 140 ----------
ML, MR = 65, W - 140
CARD = (ML, 640, MR - ML, 760)          # 875 x 760
AR = CARD[2] / CARD[3]
LABEL_TOP = CARD[1] + CARD[3] + 30
BAR_Y = 250
F_TITLE, F_SUB = E.font("bold", 58), E.font("reg", 48)
TEXT_X = ML + 120
TEXT_W = MR - TEXT_X
END = 49.6  # fim do último passo

# ---------- passos: (início, fim, título = ação, linha de apoio = para quê) ----------
STEPS = [
    (4.4, 11.6, "Abra os arquivos", "o botão fica no topo do painel"),
    (11.6, 17.6, "Abra uma pasta ali mesmo", "ela se abre na árvore, sem trocar de tela"),
    (17.6, 22.4, "Filtre pelo nome", "digite parte do nome do arquivo"),
    (22.4, 28.4, "Ache em qualquer pasta", "a busca olha até as pastas que você não abriu"),
    (28.4, 35.4, "Leia o .md já formatado", "títulos, listas e código prontos para ler"),
    (35.4, 41.0, "Veja o texto original", "em Código, o arquivo aparece como foi escrito"),
    (41.0, END, "Abra o .html como página", "o relatório aparece desenhado, sem rodar scripts"),
]

# ---------- câmeras (coordenadas do print) ----------
def cam(x, y, w): return dict(x=x, y=y, w=w, h=w / AR)
C_TREE, C_MD = cam(800, 360, 1320), cam(330, 370, 1150)
CAM = (E.Keys(cam(880, 0, 2000)).to(5.6, 1.2, **cam(1640, 0, 900)).to(10.7, 1.0, **C_TREE)
       .to(30.1, 1.0, **C_MD).to(41.0, 0.8, **C_TREE)
       .to(43.3, 1.0, **cam(330, 150, 1500)).to(45.6, 1.0, **cam(1080, 120, 1450)))

# ---------- alvos (print px) ----------
FILES_BTN = (2100, 11, 208, 68)          # "Arquivos" no topo
DOCS = (842, 844, 1196, 60)              # pasta docs (d-tree)
DOCS_KIDS = (842, 844, 1196, 120)        # arquivos de docs já abertos (d-tree-docs)
FILTER = (842, 674, 1196, 102)           # campo "Filtrar por nome…" (d-tree-docs)
SCOPE = (842, 1186, 1196, 54)            # "Busca pelo nome em arquivos do git" (d-filter)
FOUND = (842, 938, 1196, 240)            # relatorios/… e scripts/… achados sem abrir as pastas
MD_ROW, HTML_ROW = (842, 878, 1196, 60), (842, 998, 1196, 60)
VIEW = (370, 565, 208, 56)               # "Visualizar"
CODE = (582, 570, 180, 56)               # "Código"
SANDBOX = (2047, 259, 469, 36)           # "Scripts desativados nesta visualização"


def center(r): return (r[0] + r[2] / 2, r[1] + r[3] / 2)


# um destaque e um rótulo por vez: (t0, t1, alvo, linhas do rótulo)
FOCUS = [
    (8.0, 10.4, FILES_BTN, ["Arquivos"]),
    (13.0, 15.2, DOCS, ["docs"]),
    (15.8, 17.6, DOCS_KIDS, ["arquitetura.md", "backup-noturno.md"]),
    (18.8, 20.4, FILTER, ["Filtrar por nome…"]),
    (22.8, 25.6, SCOPE, ["Busca pelo nome", "em arquivos do git"]),
    (25.8, 28.4, FOUND, ["relatorio-backup.html", "backup.sh"]),
    (31.4, 35.4, VIEW, ["Visualizar"]),
    (37.6, 41.0, CODE, ["Código"]),
    (46.6, END, SANDBOX, ["Scripts desativados", "nesta visualização"]),
]
CLICKS = [(10.2, center(FILES_BTN)), (15.0, (1000, 874)), (19.6, (1100, 725)), (29.6, (1100, 908)),
          (36.8, center(CODE)), (42.8, (1150, 1028))]
CURSOR = [(4.8, (1700, 700)), (7.8, center(FILES_BTN)), (12.8, (1000, 874)), (16.4, (1500, 1270)), (18.8, (1100, 725)),
          (29.2, (1100, 908)), (36.4, center(CODE)), (42.4, (1150, 1028))]
PRINTS = [(0, "d-full"), (7.8, "d-files-hover"), (10.6, "d-tree"), (12.8, "d-tree-hover"), (15.4, "d-tree-docs"),
          (20.4, "d-filter-bac"), (21.0, "d-filter"), (30.0, "d-md"), (37.2, "d-md-code"), (41.0, "d-filter"), (43.2, "d-html")]

COVER = (["Navegue pelos", "arquivos do projeto"], "abra pastas, filtre pelo nome e leia .md e .html")
CLOSE = (["Seus arquivos,", "a um clique"], "árvore, filtro e .md e .html formatados")
CAPTIONS = ([s[2] for s in STEPS] + [s[3] for s in STEPS] + [ln for f in FOCUS for ln in f[3]]
            + COVER[0] + [COVER[1]] + CLOSE[0] + [CLOSE[1]] + ["DevDA"])


def print_at(t):
    return [n for t0, n in PRINTS if t >= t0][-1]


# ---------- desenho ----------
def draw_check(c, x, y, s, color, k=1.0, width=8):
    ck = skia.Path(); ck.moveTo(x - s * .45, y); ck.lineTo(x - s * .12, y + s * .32); ck.lineTo(x + s * .5, y - s * .36)
    seg = skia.Path(); m = skia.PathMeasure(ck, False); m.getSegment(0, m.getLength() * k, seg, True)
    p = E.paint(color, stroke=width); p.setStrokeCap(skia.Paint.kRound_Cap); p.setStrokeJoin(skia.Paint.kRound_Join)
    c.drawPath(seg, p)


def card(c, t, a):
    x, y, w, h = CARD
    E.rrect(c, x, y, w, h, 26, E.PANEL, alpha=a, shadow=True)
    name, cm = print_at(t), CAM.at(t)
    c.save()
    c.clipRRect(skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(x, y, w, h), 26, 26), doAntiAlias=True)
    c.saveLayerAlpha(skia.Rect.MakeXYWH(x, y, w, h), int(255 * a))
    E.draw_cam(c, IMG[name], cm, CARD)
    for tsw, _ in PRINTS[1:]:  # o print anterior some por cima do novo em 0,25 s
        if tsw <= t < tsw + 0.25:
            c.saveLayerAlpha(skia.Rect.MakeXYWH(x, y, w, h), int(255 * (1 - E.prog(t, tsw, 0.25, E.sine_io))))
            E.draw_cam(c, IMG[print_at(tsw - 0.01)], cm, CARD); c.restore()
    c.restore(); c.restore()
    E.rrect(c, x, y, w, h, 26, E.LINE, alpha=a, stroke=2)
    return cm


def screen_rect(r, cm):
    x0, y0 = E.src_to_screen((r[0], r[1]), cm, CARD)
    x1, y1 = E.src_to_screen((r[0] + r[2], r[1] + r[3]), cm, CARD)
    return x0, y0, x1 - x0, y1 - y0


def label_font(s):  # nome de arquivo ou pasta em mono; texto da tela em semi
    return E.font("mono", 46) if " " not in s and ("." in s or s == "docs") else E.font("semi", 54)


def label(c, lines, t, t0, out):
    k = E.prog(t, t0, 0.45, E.back_out)
    if k <= 0: return
    fonts = [label_font(s) for s in lines]
    w = max(E.measure(s, f) for s, f in zip(lines, fonts)) + 84
    h = 100 + 64 * (len(lines) - 1)
    a = min(1, k) * out
    c.save(); c.translate(ML + CARD[2] / 2, LABEL_TOP + h / 2); c.scale(k, k)
    E.rrect(c, -w / 2, -h / 2, w, h, 44, E.PANEL, alpha=a, shadow=True)
    E.rrect(c, -w / 2, -h / 2, w, h, 44, E.BRAND, alpha=a, stroke=3)
    for i, (s, f) in enumerate(zip(lines, fonts)):
        E.text(c, s, 0, -h / 2 + 68 + 64 * i, f, alpha=a)
    c.restore()


def focus(c, t, cm):
    for t0, t1, r, lines in FOCUS:
        if not (t0 <= t < t1): continue
        out = 1 - E.prog(t, t1 - 0.3, 0.3, E.expo_in)
        sx, sy, sw, sh = screen_rect(r, cm)
        pad = 8
        c.save(); c.clipRect(skia.Rect.MakeXYWH(*CARD))
        k = E.prog(t, t0, 0.6, E.expo_out)
        path = skia.Path(); path.addRRect(skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(sx - pad, sy - pad, sw + 2 * pad, sh + 2 * pad), 16, 16))
        seg = skia.Path(); m = skia.PathMeasure(path, False); m.getSegment(0, m.getLength() * k, seg, True)
        c.drawPath(seg, E.paint(E.BRAND, out, stroke=6))
        c.restore()
        label(c, lines, t, t0 + 0.35, out)


def cursor(c, t, cm):
    if t < CURSOR[0][0]: return
    pa = pb = CURSOR[0][1]; k = 1.0
    for (ta, a0), (tb, b0) in zip(CURSOR, CURSOR[1:]):
        if t < tb - 0.9: pa = pb = a0; break
        pa, pb, k = a0, b0, E.prog(t, tb - 0.9, 0.9, E.expo_io)
    x, y = E.src_to_screen((E.lerp(pa[0], pb[0], k), E.lerp(pa[1], pb[1], k)), cm, CARD)
    a = E.prog(t, CURSOR[0][0], 0.3, E.sine_io) * (1 - E.prog(t, END - 0.4, 0.3, E.expo_in))
    x += 6; y += 10
    tri = skia.Path(); tri.moveTo(x, y); tri.lineTo(x, y + 46); tri.lineTo(x + 13, y + 34); tri.lineTo(x + 32, y + 34); tri.close()
    c.save(); c.clipRect(skia.Rect.MakeXYWH(*CARD))
    c.drawPath(tri, E.paint(E.FG, a)); c.drawPath(tri, E.paint(E.BG, a, stroke=3)); c.restore()


def clicks(c, t, cm):
    for tc, pt in CLICKS:
        if not (tc <= t < tc + 0.5): continue
        k = E.prog(t, tc, 0.5, E.expo_out)
        sx, sy = E.src_to_screen(pt, cm, CARD)
        c.save(); c.clipRect(skia.Rect.MakeXYWH(*CARD))
        c.drawCircle(sx, sy, 18 + 70 * k, E.paint(E.BRAND, 1 - k, stroke=5))
        c.restore()


def header(c, t):
    idx = next((i for i, s in enumerate(STEPS) if s[0] <= t < s[1]), None)
    if idx is None: return
    t0, t1, title, sub = STEPS[idx]
    gap = 14; n = len(STEPS); seg = (MR - ML - gap * (n - 1)) / n
    a0 = E.prog(t, 4.2, 0.5, E.expo_out) * (1 - E.prog(t, END - 0.3, 0.3, E.expo_in))
    for i in range(n):
        x = ML + i * (seg + gap)
        E.rrect(c, x, BAR_Y, seg, 8, 4, E.LINE, alpha=a0)
        fill = 1.0 if i < idx else E.prog(t, t0, 0.5, E.expo_out) if i == idx else 0
        if fill > 0: E.rrect(c, x, BAR_Y, seg * fill, 8, 4, E.BRAND, alpha=a0)
    k_in = E.prog(t, t0 + 0.05, 0.5, E.expo_out)
    k_out = E.prog(t, t1 - 0.3, 0.3, E.expo_in)
    a = k_in * (1 - k_out); dy = (1 - k_in) * 30 - k_out * 20
    cx, cy = ML + 46, 370
    s = E.prog(t, t0 + 0.05, 0.45, E.back_out)
    c.drawCircle(cx, cy + dy, 46 * s, E.paint(E.BRAND, a))
    E.text(c, str(idx + 1), cx, cy + 19 + dy, E.font("black", 54), color=E.BG, alpha=a)
    E.text(c, title, TEXT_X, 390 + dy, F_TITLE, alpha=a, align="left")
    a2 = E.prog(t, t0 + 0.18, 0.5, E.expo_out) * (1 - k_out)
    for i, ln in enumerate(K.wrap(sub, F_SUB, TEXT_W)):
        E.text(c, ln, TEXT_X, 468 + i * 60 + dy + (1 - a2) * 16, F_SUB, color=E.MUTED, alpha=a2, align="left")


def big_text(c, t, t0, lines, sub, out, y0):
    f = E.font("black", 92)
    for i, ln in enumerate(lines):
        a = E.prog(t, t0 + i * 0.12, 0.55, E.expo_out) * out
        E.text(c, ln, W / 2, y0 + i * 108 + (1 - a) * 40, f, alpha=a)
    a = E.prog(t, t0 + 0.5, 0.6, E.expo_out) * out
    fs = E.font("reg", 50)
    for i, ln in enumerate(K.wrap(sub, fs, MR - ML)):
        E.text(c, ln, W / 2, y0 + len(lines) * 108 + 40 + i * 62 + (1 - a) * 20, fs, color=E.MUTED, alpha=a)


def cover(c, t):
    out = 1 - E.prog(t, 4.0, 0.35, E.expo_in)
    if out <= 0: return
    a = E.prog(t, 0.1, 0.6, E.expo_out) * out
    E.text(c, "DevDA", W / 2, 700 + (1 - a) * 30, E.font("black", 64), color=E.BRAND, alpha=a, tracking=2)
    big_text(c, t, 0.4, COVER[0], COVER[1], out, 860)


def closing(c, t):
    if t < END + 0.2: return
    cx, cy = W / 2, 720
    s = E.prog(t, END + 0.3, 0.5, E.back_out)
    c.drawCircle(cx, cy, 90 * s, E.paint(E.BRAND))
    draw_check(c, cx + 2, cy + 4, 92, E.BG, E.prog(t, END + 0.7, 0.5, E.expo_out), 14)
    big_text(c, t, END + 1.0, CLOSE[0], CLOSE[1], 1.0, 940)


def draw(c, t):
    p = skia.Paint(); p.setShader(skia.GradientShader.MakeRadial(skia.Point(W / 2, H * .45), H * .6, [0xFF14302A, E.BG]))
    c.drawRect(skia.Rect.MakeWH(W, H), p)
    cover(c, t)
    closing(c, t)
    if t < 4.3 or t >= END + 0.2: return
    header(c, t)
    a = E.prog(t, 4.4, 0.6, E.expo_out) * (1 - E.prog(t, END - 0.2, 0.35, E.expo_in))
    dy = (1 - E.prog(t, 4.4, 0.6, E.expo_out)) * 60
    c.save(); c.translate(0, dy)
    cm = card(c, t, a)
    if a > 0.05:
        cursor(c, t, cm); clicks(c, t, cm); focus(c, t, cm)
    c.restore()


def audio():
    return None  # /ajuda do DevDA: sem áudio


if __name__ == "__main__":
    for s in CAPTIONS:
        for fn in ("semi", "bold", "reg", "mono", "black"):
            f = E.font(fn, 48)
            assert not E.missing_glyphs(s, f) and not E.fallback_glyphs(s, f), (s, fn)
    for t0, t1, ti, su in STEPS:
        ws = len(ti.split()) + len(su.split())
        assert E.measure(ti, F_TITLE) <= TEXT_W, ti
        lines = K.wrap(su, F_SUB, TEXT_W)
        assert len(lines) <= 2 and all(len(l.split()) <= 7 for l in lines), su
        print(f"{t1 - t0 - 0.7:4.1f}s visíveis, {ws} palavras (mín {ws * 0.3:.1f}s)  {ti} | {lines}")
    for t0, t1, r, lines in FOCUS:
        w = max(E.measure(s, label_font(s)) for s in lines) + 84
        assert w <= CARD[2], (lines, w)
    print("glifos ok:", len(CAPTIONS), "textos")
