"""Enviar feedback (série "Veja em ação" do DevDA, vídeo 4). 9:16, sem áudio.

Prints da sessão de demonstração com textos fictícios em pt-BR (em prints/). O portal e o envio
são simulados na cópia da demo (resposta 201 sem número de chamado): nada vai ao GLPI.
Desktop 1440x900 @2x (2880x1800). Alvos em pixels do print (CSS x2), medidos pelo Playwright.
"""
import os
import engine as E  # antes do skia
import skia
import kit as K

FORMAT, DURATION, POSTER_T = "9:16", 55.0, 2.6
W, H = E.size(FORMAT)
HERE = os.path.dirname(os.path.abspath(__file__))
NAMES = ("d-full", "d-fb-hover", "d-fb-menu", "d-fb-form", "d-fb-typed", "d-fb-picker", "d-fb-attached", "d-fb-sent")
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
END = 49.0  # fim do último passo

# ---------- passos: (início, fim, título = ação, linha de apoio = para quê) ----------
STEPS = [
    (4.4, 11.0, "Abra o feedback", "fica no topo, ao lado do sino"),
    (11.0, 16.6, "Escolha o tipo", "erro, sugestão de melhoria ou feedback geral"),
    (16.6, 23.0, "Descreva com detalhes", "a equipe recebe como chamado"),
    (23.0, 29.0, "Inclua os dados técnicos", "ajudam a equipe; senhas e tokens vão mascarados"),
    (29.0, 36.4, "Aponte o problema na tela", "o print da tela vai junto"),
    (36.4, 42.4, "Confira o print", "veja se não aparece nenhum dado sensível"),
    (42.4, END, "Envie o chamado", "ele chega à equipe Data Agile"),
]

# ---------- câmeras (coordenadas do print) ----------
def cam(x, y, w): return dict(x=x, y=y, w=w, h=w / AR)
CAM = (E.Keys(cam(880, 0, 2000)).to(5.6, 1.2, **cam(1700, 0, 900)).to(15.7, 1.0, **cam(860, 280, 1160))
       .to(23.0, 0.9, **cam(860, 560, 1160)).to(31.9, 1.0, **cam(800, 200, 1840))
       .to(35.9, 1.0, **cam(860, 700, 1160)).to(44.3, 1.0, **cam(860, 500, 1160)))

# ---------- alvos (print px) ----------
FB = (2240, 11, 68, 68)                  # megafone "Enviar feedback"
MENU = (1892, 88, 416, 224)              # menu com os 3 tipos
BUG = (1902, 98, 396, 68)                # "Reportar erro"
DESC = (920, 512, 1040, 276)             # "Descrição (obrigatório)" e o campo
TECH = (920, 1136, 1040, 40)             # "Incluir dados técnicos no chamado"
PICK = (1242, 864, 436, 68)              # "Selecionar elemento na tela"
HINT = (910, 1648, 1062, 104)            # "Clique num elemento ou arraste para recortar"
THUMB = (920, 988, 1040, 524)            # "Elemento selecionado: …" e o print
SEND = (1836, 1528, 124, 68)             # "Enviar" (d-fb-attached)
DONE = (920, 876, 680, 102)              # "Chamado aberto"


def center(r): return (r[0] + r[2] / 2, r[1] + r[3] / 2)


# um destaque e um rótulo por vez: (t0, t1, alvo, linhas do rótulo)
FOCUS = [
    (7.6, 10.0, FB, ["Enviar feedback"]),
    (11.4, 14.0, MENU, ["Reportar erro", "Sugestão de melhoria", "Feedback geral"]),
    (19.0, 23.0, DESC, ["Descrição (obrigatório)"]),
    (23.6, 29.0, TECH, ["Incluir dados técnicos", "no chamado"]),
    (29.4, 31.6, PICK, ["Selecionar elemento", "na tela"]),
    (32.8, 35.2, HINT, ["Clique num elemento ou", "arraste para recortar"]),
    (36.8, 42.4, THUMB, ["Elemento selecionado:", "div.chat-transcript"]),
    (45.4, END, DONE, ["Chamado aberto"]),
]
CLICKS = [(9.8, center(FB)), (15.2, center(BUG)), (31.4, center(PICK)), (35.4, (2200, 540)), (43.8, center(SEND))]
CURSOR = [(4.8, (1700, 700)), (7.4, center(FB)), (14.6, center(BUG)), (16.4, (1960, 1240)), (31.0, center(PICK)),
          (34.6, (2200, 540)), (36.4, (1960, 1650)), (43.4, center(SEND)), (45.0, (1960, 1400))]
PRINTS = [(0, "d-full"), (7.4, "d-fb-hover"), (10.2, "d-fb-menu"), (15.6, "d-fb-form"), (18.6, "d-fb-typed"),
          (31.8, "d-fb-picker"), (35.8, "d-fb-attached"), (44.2, "d-fb-sent")]

COVER = (["Envie um feedback", "sem sair do DevDA"], "erro, sugestão ou comentário vira chamado na equipe Data Agile")
CLOSE = (["Seu relato,", "direto para a equipe"], "erro, sugestão ou feedback em poucos cliques")
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
