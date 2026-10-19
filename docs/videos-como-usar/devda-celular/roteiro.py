"""DevDA no celular (série "Veja em ação" do DevDA, vídeo 6). 9:16, sem áudio.

Prints da sessão de demonstração com textos fictícios em pt-BR (em prints/, `_captura/prep-ptbr.py`).
Celular 390x844 @3x (1170x2532). Alvos em pixels do print (CSS x3), medidos pelo Playwright.
No celular não há cursor: o toque aparece só como o círculo do clique.
"""
import os
import engine as E  # antes do skia
import skia
import kit as K

FORMAT, DURATION, POSTER_T = "9:16", 42.0, 2.6
W, H = E.size(FORMAT)
HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = ("p-full", "p-bell-on", "p-drawer", "p-blocked")
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
END = 37.0  # fim do último passo

# ---------- passos: (início, fim, título = ação, linha de apoio = para quê) ----------
STEPS = [
    (4.4, 11.0, "Ligue os Alertas", "o sino avisa quando um agente precisa de você"),
    (11.0, 16.6, "Abra a lista de projetos", "no canto de cima, à esquerda"),
    (16.6, 22.6, "Quem espera por você", "perguntas e trabalhos já prontos"),
    (22.6, 28.6, "Instale o app", "no iPhone, para receber alertas"),
    (28.6, END, "Responda pelo celular", "toque numa das opções"),
]

# ---------- câmeras (coordenadas do print) ----------
def cam(x, y, w): return dict(x=x, y=y, w=w, h=w / AR)
TOP, BELL, MENU_C = cam(0, 0, 1170), cam(400, 0, 770), cam(0, 0, 770)
LIST, FOOT, ASK = cam(0, 380, 1170), cam(0, 1490, 1170), cam(0, 1450, 1170)
CAM = (E.Keys(TOP).to(5.6, 1.2, **BELL).to(11.2, 1.0, **MENU_C).to(14.6, 1.0, **LIST)
       .to(22.8, 1.0, **FOOT).to(28.8, 1.0, **LIST).to(31.8, 0.8, **ASK))

# ---------- alvos (print px) ----------
BELLB = (786, 18, 120, 120)              # sino "Alertas"
MENU = (24, 18, 120, 120)                # "Abrir lista de projetos"
BLOCK = (45, 558, 864, 396)              # "Precisa de você 2" e as duas linhas
INSTALL = (36, 2202, 885, 120)           # "Instalar app"
BLOCKED = (45, 678, 864, 138)            # "Proteger o botão de exportar" · ENTRADA
CARDQ = (36, 1472, 1100, 650)            # "Permitir o comando?" e as 3 opções


def center(r): return (r[0] + r[2] / 2, r[1] + r[3] / 2)


# um destaque e um rótulo por vez: (t0, t1, alvo, linhas do rótulo)
FOCUS = [
    (7.0, 11.0, BELLB, ["Alertas"]),
    (11.8, 14.6, MENU, ["Abrir lista de projetos"]),
    (17.0, 22.6, BLOCK, ["Precisa de você"]),
    (23.8, 28.6, INSTALL, ["Instalar app"]),
    (29.6, 31.8, BLOCKED, ["ENTRADA"]),
    (32.6, END, CARDQ, ["Permitir o comando?"]),
]
CLICKS = [(9.0, center(BELLB)), (14.2, center(MENU)), (31.4, center(BLOCKED))]
PRINTS = [(0, "p-full"), (9.2, "p-bell-on"), (14.4, "p-drawer"), (31.8, "p-blocked")]

COVER = (["O DevDA", "no celular"], "acompanhe e responda os agentes de onde estiver")
CLOSE = (["Seus agentes,", "no seu bolso"], "alerta, lista e resposta no celular")
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
    return E.font("mono", 46) if " " not in s and "." in s else E.font("semi", 54)


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
        clicks(c, t, cm); focus(c, t, cm)
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
