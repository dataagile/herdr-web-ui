"""Copiar o caminho da pasta (série "Veja em ação" do DevDA, vídeo 1). 9:16, sem áudio.

Prints da sessão de demonstração com textos fictícios em pt-BR (em prints/):
desktop 1440x900 @2x (2880x1800) e celular 390x844 @3x (1170x2532).
Alvos em pixels do print (CSS x2 no desktop, x3 no celular), medidos pelo Playwright.
"""
import os
import math
import engine as E  # antes do skia
import skia
import kit as K

FORMAT, DURATION, POSTER_T = "9:16", 42.0, 2.6
W, H = E.size(FORMAT)
HERE = os.path.dirname(os.path.abspath(__file__))


def _img(name):  # tamanho nativo: o zoom no cabeçalho fica nítido
    return E.load_image(os.path.join(HERE, "prints", f"{name}.png"), 2880, 3840)


IMG = {k: _img(k) for k in ("d-full", "d-copy-hover", "d-copied", "p-full", "p-copied", "p-drawer")}

# ---------- grade 9:16: margem 65; área segura topo 220, base 320, direita 140 ----------
ML, MR = 65, W - 140
CARD = (ML, 640, MR - ML, 760)          # 875 x 760
AR = CARD[2] / CARD[3]
LABEL_TOP = CARD[1] + CARD[3] + 30      # rótulo começa 30 px abaixo do cartão
BAR_Y = 250
F_TITLE, F_SUB = E.font("bold", 58), E.font("reg", 48)
TEXT_X = ML + 120
TEXT_W = MR - TEXT_X

# ---------- passos: (início, fim, título = ação, linha de apoio = para quê) ----------
STEPS = [
    (4.4, 11.0, "Veja onde o painel está", "em qual computador e projeto você está"),
    (11.0, 16.4, "Clique no ícone de copiar", "para colar no terminal, num chamado ou numa mensagem"),
    (16.4, 22.0, "Pronto, já pode colar", "o ícone vira um visto"),
    (22.0, 29.0, "No celular, o mesmo ícone", "fica no topo, ao lado do menu"),
    (29.0, 37.0, "Leia o caminho inteiro", "ele é a primeira linha do menu"),
]

# ---------- câmeras (coordenadas do print) ----------
def cam(x, y, w): return dict(x=x, y=y, w=w, h=w / AR)
D_ALL, D_ZOOM = cam(880, 0, 2000), cam(640, 0, 760)
CAM_D = E.Keys(D_ALL).to(5.6, 1.2, **D_ZOOM)
CAM_P = E.Keys(cam(0, 0, 1170)).to(32.5, 1.0, **cam(0, 120, 760))

# ---------- alvos (print px) ----------
T_CRUMB = (1124, 14, 162, 62)       # "pc-dev › infra"
T_COPY = (1283, 15, 60, 60)         # ícone de copiar no fim do breadcrumb
P_COPY = (144, 18, 120, 120)        # ícone de copiar no topo do celular
P_MENU = (24, 18, 120, 120)         # menu (abre a gaveta)
P_PATH = (30, 176, 580, 66)         # caminho completo no começo da gaveta


def center(r): return (r[0] + r[2] / 2, r[1] + r[3] / 2)


# um destaque e um rótulo por vez: (t0, t1, modo, alvo, linhas do rótulo, tom)
FOCUS = [
    (7.2, 11.0, "d", T_CRUMB, ["pc-dev › infra"], None),
    (12.6, 16.0, "d", T_COPY, ["Copiar caminho:", "/home/dev/projetos/infra"], None),
    (16.6, 22.0, "d", T_COPY, ["Caminho copiado"], "ok"),
    (23.2, 26.6, "p", P_COPY, ["Copiar caminho:", "/home/dev/projetos/infra"], None),
    (27.0, 29.0, "p", P_COPY, ["Caminho copiado"], "ok"),
    (29.6, 31.4, "p", P_MENU, ["Abrir lista de projetos"], None),
    (33.4, 37.0, "p", P_PATH, ["/home/dev/projetos/infra"], None),
]
CLICKS = [(15.8, "d", center(T_COPY)), (26.6, "p", center(P_COPY)), (31.2, "p", center(P_MENU))]
CURSOR = [(4.8, (1700, 700)), (12.3, center(T_COPY))]   # (chegada, ponto) só no desktop
SWITCHES = (12.3, 16.2, 27.0)                          # troca de print no mesmo lugar
MASK = (31.6, "p", center(P_MENU), "p-full", "p-drawer")  # o toque no menu abre a gaveta

COVER = (["Copie o caminho", "da pasta do painel"], "no computador e no celular")
CLOSE = (["O caminho da pasta,", "em um clique"], "no topo, no computador e no celular")
CAPTIONS = ([s[2] for s in STEPS] + [s[3] for s in STEPS] + [ln for f in FOCUS for ln in f[4]]
            + COVER[0] + [COVER[1]] + CLOSE[0] + [CLOSE[1]] + ["DevDA"])


def print_at(t):
    if t < 22.0:
        name = "d-full" if t < 12.3 else "d-copy-hover" if t < 16.2 else "d-copied"
        return name, CAM_D.at(t), "d"
    name = "p-full" if t < 27.0 else "p-copied" if t < 29.0 else "p-full"
    return name, CAM_P.at(t), "p"


# ---------- desenho ----------
def draw_check(c, x, y, s, color, k=1.0, width=8):
    ck = skia.Path(); ck.moveTo(x - s * .45, y); ck.lineTo(x - s * .12, y + s * .32); ck.lineTo(x + s * .5, y - s * .36)
    seg = skia.Path(); m = skia.PathMeasure(ck, False); m.getSegment(0, m.getLength() * k, seg, True)
    p = E.paint(color, stroke=width); p.setStrokeCap(skia.Paint.kRound_Cap); p.setStrokeJoin(skia.Paint.kRound_Join)
    c.drawPath(seg, p)


def card(c, t, a):
    x, y, w, h = CARD
    E.rrect(c, x, y, w, h, 26, E.PANEL, alpha=a, shadow=True)
    name, cm, mode = print_at(t)
    c.save()
    c.clipRRect(skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(x, y, w, h), 26, 26), doAntiAlias=True)
    c.saveLayerAlpha(skia.Rect.MakeXYWH(x, y, w, h), int(255 * a))
    E.draw_cam(c, IMG[name], cm, CARD)
    for tsw in SWITCHES:  # o print anterior some por cima do novo em 0,25 s
        if tsw <= t < tsw + 0.25:
            prev, _, pm = print_at(tsw - 0.01)
            if pm == mode and prev != name:
                c.saveLayerAlpha(skia.Rect.MakeXYWH(x, y, w, h), int(255 * (1 - E.prog(t, tsw, 0.25, E.sine_io))))
                E.draw_cam(c, IMG[prev], cm, CARD); c.restore()
    tm, mm, pt, before, after = MASK
    if mm == mode and t >= tm:
        k = E.prog(t, tm, 1.0, E.expo_io)
        ox, oy = E.src_to_screen(pt, cm, CARD)
        r = k * math.hypot(w, h) * 1.15
        path = skia.Path(); path.addCircle(ox, oy, r)
        c.save(); c.clipPath(path, doAntiAlias=True); E.draw_cam(c, IMG[after], cm, CARD); c.restore()
        if k < 1: c.drawCircle(ox, oy, r, E.paint(E.FG, 1 - k, stroke=5))
    c.restore(); c.restore()
    E.rrect(c, x, y, w, h, 26, E.LINE, alpha=a, stroke=2)
    return cm, mode


def screen_rect(r, cm):
    x0, y0 = E.src_to_screen((r[0], r[1]), cm, CARD)
    x1, y1 = E.src_to_screen((r[0] + r[2], r[1] + r[3]), cm, CARD)
    return x0, y0, x1 - x0, y1 - y0


def label(c, lines, t, t0, out, tone):
    k = E.prog(t, t0, 0.45, E.back_out)
    if k <= 0: return
    f1 = E.font("mono", 46) if lines[0].startswith("/") else E.font("semi", 54)
    f2 = E.font("mono", 46)
    icon = 76 if tone == "ok" else 0
    w = max([E.measure(lines[0], f1)] + [E.measure(s, f2) for s in lines[1:]]) + 84 + icon
    h = 100 + 64 * (len(lines) - 1)
    a = min(1, k) * out
    cx = ML + CARD[2] / 2
    c.save(); c.translate(cx, LABEL_TOP + h / 2); c.scale(k, k)
    col = E.OK if tone == "ok" else E.BRAND
    E.rrect(c, -w / 2, -h / 2, w, h, 44, E.PANEL, alpha=a, shadow=True)
    E.rrect(c, -w / 2, -h / 2, w, h, 44, col, alpha=a, stroke=3)
    y = -h / 2 + 68
    if tone == "ok":
        draw_check(c, -w / 2 + 66, y - 18, 42, E.OK, E.prog(t, t0 + 0.1, 0.4, E.expo_out), 7)
        E.text(c, lines[0], -w / 2 + 42 + icon, y, f1, alpha=a, align="left")
    else:
        E.text(c, lines[0], 0, y, f1, alpha=a)
        for i, s in enumerate(lines[1:]):
            E.text(c, s, 0, y + 64 * (i + 1), f2, color=E.FG, alpha=a)
    c.restore()


def focus(c, t, cm, mode):
    for t0, t1, md, r, lines, tone in FOCUS:
        if md != mode or not (t0 <= t < t1): continue
        out = 1 - E.prog(t, t1 - 0.3, 0.3, E.expo_in)
        sx, sy, sw, sh = screen_rect(r, cm)
        pad = 8
        c.save(); c.clipRect(skia.Rect.MakeXYWH(*CARD))
        k = E.prog(t, t0, 0.6, E.expo_out)
        path = skia.Path(); path.addRRect(skia.RRect.MakeRectXY(skia.Rect.MakeXYWH(sx - pad, sy - pad, sw + 2 * pad, sh + 2 * pad), 16, 16))
        seg = skia.Path(); m = skia.PathMeasure(path, False); m.getSegment(0, m.getLength() * k, seg, True)
        c.drawPath(seg, E.paint(E.OK if tone == "ok" else E.BRAND, out, stroke=6))
        c.restore()
        label(c, lines, t, t0 + 0.35, out, tone)


def cursor(c, t, cm, mode):
    if mode != "d" or t < CURSOR[0][0]: return
    (ta, pa), (tb, pb) = CURSOR
    k = E.prog(t, tb - 0.9, 0.9, E.expo_io)
    x, y = E.src_to_screen((E.lerp(pa[0], pb[0], k), E.lerp(pa[1], pb[1], k)), cm, CARD)
    a = E.prog(t, ta, 0.3, E.sine_io) * (1 - E.prog(t, 21.6, 0.3, E.expo_in))
    x += 6; y += 10
    tri = skia.Path(); tri.moveTo(x, y); tri.lineTo(x, y + 46); tri.lineTo(x + 13, y + 34); tri.lineTo(x + 32, y + 34); tri.close()
    c.save(); c.clipRect(skia.Rect.MakeXYWH(*CARD))
    c.drawPath(tri, E.paint(E.FG, a)); c.drawPath(tri, E.paint(E.BG, a, stroke=3)); c.restore()


def clicks(c, t, cm, mode):
    for tc, md, pt in CLICKS:
        if md != mode or not (tc <= t < tc + 0.5): continue
        k = E.prog(t, tc, 0.5, E.expo_out)
        sx, sy = E.src_to_screen(pt, cm, CARD)
        c.save(); c.clipRect(skia.Rect.MakeXYWH(*CARD))
        c.drawCircle(sx, sy, 18 + 70 * k, E.paint(E.BRAND, 1 - k, stroke=5))
        if md == "p": c.drawCircle(sx, sy, 34, E.paint(E.FG, 0.35 * (1 - k)))
        c.restore()


def header(c, t):
    idx = next((i for i, s in enumerate(STEPS) if s[0] <= t < s[1]), None)
    if idx is None: return
    t0, t1, title, sub = STEPS[idx]
    gap = 14; n = len(STEPS); seg = (MR - ML - gap * (n - 1)) / n
    a0 = E.prog(t, 4.2, 0.5, E.expo_out) * (1 - E.prog(t, 36.7, 0.3, E.expo_in))
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
    if t < 37.2: return
    cx, cy = W / 2, 720
    s = E.prog(t, 37.3, 0.5, E.back_out)
    c.drawCircle(cx, cy, 90 * s, E.paint(E.BRAND))
    draw_check(c, cx + 2, cy + 4, 92, E.BG, E.prog(t, 37.7, 0.5, E.expo_out), 14)
    big_text(c, t, 38.0, CLOSE[0], CLOSE[1], 1.0, 940)


def draw(c, t):
    p = skia.Paint(); p.setShader(skia.GradientShader.MakeRadial(skia.Point(W / 2, H * .45), H * .6, [0xFF14302A, E.BG]))
    c.drawRect(skia.Rect.MakeWH(W, H), p)
    cover(c, t)
    closing(c, t)
    if t < 4.3 or t >= 37.2: return
    header(c, t)
    a = E.prog(t, 4.4, 0.6, E.expo_out) * (1 - E.prog(t, 36.8, 0.35, E.expo_in))
    dy = (1 - E.prog(t, 4.4, 0.6, E.expo_out)) * 60
    # computador -> celular em 22 s: o cartão sai para baixo e volta com o celular
    if 21.7 <= t < 22.6:
        k_out = E.prog(t, 21.7, 0.3, E.expo_in); k_in = E.prog(t, 22.0, 0.5, E.expo_out)
        if t < 22.0: a *= 1 - k_out; dy += 40 * k_out
        else: a *= k_in; dy += 40 * (1 - k_in)
    c.save(); c.translate(0, dy)
    cm, mode = card(c, t, a)
    if a > 0.05:
        cursor(c, t, cm, mode); clicks(c, t, cm, mode); focus(c, t, cm, mode)
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
    print("glifos ok:", len(CAPTIONS), "textos")
