"""Mascote v4 (Capitão Grafite): gato preto rechonchudo, massa contínua e orgânica, chapéu de pirata e tapa-olho.

python3 docs/brand/gerar4.py <saida>   -> SVGs + PNGs de cada pose, do rosto e da marca.
"""
import os
import sys
import cairosvg
from sdf import circle, ellipse, cone, curve, tube, poly, union, hard, cut, place, to_path

OUT = sys.argv[1] if len(sys.argv) > 1 else "svg-v4"
os.makedirs(OUT, exist_ok=True)

COB, GATO, CREME, RED, GEMA, MAD, TINTA = "#2F3CFF", "#2F3CFF", "#FFF7EA", "#F2423B", "#FFC83D", "#FBD9A4", "#14123A"


def S(d, fill, extra=""):
    return f'<path d="{d}" fill="{fill}" {extra}/>'


def line(d, w=3, c=CREME):
    return f'<path d="{d}" stroke="{c}" stroke-width="{w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'


def g(content, x=0, y=0, s=1, rot=0, flip=False):
    sx = -s if flip else s
    return f'<g transform="translate({x} {y}) rotate({rot}) scale({sx} {s})">{content}</g>'


# ---------------- cabeça ----------------
def head_shape(ear_l=0, ear_r=0):
    """Cabeça larga e achatada (pão), orelhas arredondadas. ear_*: inclinação extra das orelhas (graus)."""
    el = place(cone(0, 0, -10, -50, 26, 8), -46, -40, rot=ear_l)
    er = place(cone(0, 0, 8, -48, 26, 8), 46, -42, rot=ear_r)
    return union(ellipse(0, -4, 78, 56), ellipse(0, 20, 90, 38), el, er, k=14)


def hat():
    """Bicorne pirata em vermelho, pontas para cima, caveira creme. Coordenadas locais (centro da copa)."""
    crown = ellipse(0, -14, 50, 34)
    brim = curve((-100, -30), (-62, 14), (62, 14), (100, -30), 13, 13)
    shape = union(crown, brim, k=12)
    return shape


def hat_overlay():
    skull = (f'<circle cx="0" cy="-20" r="11.5" fill="{CREME}"/>'
             f'<rect x="-6.5" y="-12" width="13" height="8" rx="3" fill="{CREME}"/>'
             f'<circle cx="-4.2" cy="-21" r="3.1" fill="{RED}"/><circle cx="4.2" cy="-21" r="3.1" fill="{RED}"/>'
             + line("M-19 -3 L19 -33 M-19 -33 L19 -3", 4.2))
    band = line("M-74 -10 C-40 8 40 8 74 -10", 4.5, "#C92A25")
    return band + skull


def face(mood="cool"):
    """Rosto em coordenadas locais da cabeça. mood: cool | feliz | dormindo | esforco."""
    out = []
    # tapa-olho (olho esquerdo do gato, à direita de quem vê? não: à esquerda de quem vê) + tira
    out.append(line("M-60 -30 C-40 -40 -10 -48 30 -58", 5, RED))
    out.append(line("M-52 -4 L-86 8", 5, RED))
    out.append(f'<ellipse cx="-34" cy="0" rx="20" ry="17" fill="{RED}"/>')
    out.append(f'<ellipse cx="-39" cy="-6" rx="6" ry="3.5" fill="#FF8A80" transform="rotate(-20 -39 -6)"/>')
    if mood == "cool":
        out.append(g(f'<path d="M-15 -4 h30 a15 15 0 0 1 -30 0 Z" fill="{CREME}"/>'
                     f'<circle cx="3" cy="2" r="6.5" fill="{TINTA}"/>', 36, 0, rot=-8))
    elif mood == "feliz":
        out.append(line("M22 4 C28 -6 42 -6 48 4", 4.5))
    elif mood == "dormindo":
        out.append(line("M22 0 C28 8 42 8 48 0", 4.5))
    elif mood == "esforco":
        out.append(line("M22 -6 L46 2 L22 8", 4.5))
    # nariz e boca
    out.append(f'<path d="M-4 18 h12 l-6 7 Z" fill="{CREME}" stroke="{CREME}" stroke-width="2" stroke-linejoin="round"/>')
    if mood == "feliz":
        out.append(f'<path d="M-8 30 C-6 44 14 44 16 30 Z" fill="{RED}"/>')
    else:
        out.append(line("M-8 31 C-4 36 1 35 2 29 C3 35 8 36 12 31", 2.8))
    # bigodes finos
    out.append(line("M50 18 L82 13 M52 27 L84 28 M-50 22 L-80 17 M-50 30 L-80 32", 2.2))
    return "".join(out)


def head(cx, cy, s=1, rot=0, mood="cool", hat_rot=-10, hat_dx=-2, hat_dy=-56, hat_s=0.72, with_hat=True):
    """Retorna (silhueta da cabeça na cena, chapéu na cena, overlay svg)."""
    sil = place(head_shape(), cx, cy, s, rot)
    hat_sdf = place(place(hat(), hat_dx, hat_dy, hat_s, hat_rot), cx, cy, s, rot) if with_hat else None
    over_face = g(face(mood), cx, cy, s, rot)
    over_hat = g(g(hat_overlay(), hat_dx, hat_dy, hat_s, hat_rot), cx, cy, s, rot) if with_hat else ""
    return sil, hat_sdf, over_face, over_hat


def pencil(x, y, L, rot, w=16):
    return (f'<g transform="translate({x} {y}) rotate({rot})">'
            f'<rect x="0" y="{-w/2}" width="{L}" height="{w}" rx="2" fill="{GEMA}"/>'
            f'<rect x="0" y="{-w/2}" width="{L}" height="{w*0.32}" rx="2" fill="#FFE08A"/>'
            f'<path d="M{L} {-w/2} L{L+w*1.3} 0 L{L} {w/2} Z" fill="{MAD}"/>'
            f'<path d="M{L+w*0.9} {-w*0.16} L{L+w*1.3} 0 L{L+w*0.9} {w*0.16} Z" fill="{TINTA}"/>'
            f'<rect x="{-w*0.8}" y="{-w/2}" width="{w*0.85}" height="{w}" fill="#B8BDD9"/>'
            f'<rect x="{-w*1.9}" y="{-w/2}" width="{w*1.2}" height="{w}" rx="{w*0.4}" fill="{RED}"/></g>')


# ---------------- cenas ----------------
def scene(name, w, h, layers, bg="#FFFFFF", rx=0):
    body = []
    if bg:
        body.append(f'<rect width="{w}" height="{h}" rx="{rx}" fill="{bg}"/>')
    for L in layers:
        if isinstance(L, str):
            body.append(L)
        else:
            f, fill = L
            body.append(S(to_path(f, w, h), fill, 'fill-rule="evenodd"'))
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{"".join(body)}</svg>'
    with open(f"{OUT}/{name}.svg", "w") as fh:
        fh.write(svg)
    cairosvg.svg2png(bytestring=svg.encode(), write_to=f"{OUT}/{name}.png", output_width=w * 2)
    print(name)


def rosto(name, mood, bg="#FFFFFF", rx=88):
    sil, hs, of, oh = head(200, 222, 1.45, 0, mood)
    scene(name, 400, 400, [(sil, GATO), of, (hs, RED), oh], bg, rx)


def books(x, y, specs):
    """Pilha de livros: specs = [(largura, altura, cor, dx)] de baixo para cima."""
    out, yy = [], y
    for w_, h_, c, dx in specs:
        yy -= h_
        out.append(f'<rect x="{x - w_/2 + dx}" y="{yy}" width="{w_}" height="{h_}" rx="5" fill="{c}"/>'
                   f'<rect x="{x - w_/2 + dx + 8}" y="{yy + h_*0.3}" width="{w_ - 16}" height="{h_*0.4}" rx="2" fill="{CREME}" opacity=".9"/>')
    return "".join(out), yy


def big_pencil(x, y, L, rot, w):
    return pencil(x, y, L, rot, w)


def pose_surf():
    """Surfando num lápis gigante: agachado, cauda para cima, chapéu voando."""
    hs, hh, of, oh = head(150, 168, 0.86, -10, "cool", hat_rot=-24, hat_dx=-14, hat_dy=-66)
    body = union(ellipse(250, 222, 96, 60, -8), hs,
                 cone(196, 240, 170, 278, 24, 18), circle(168, 280, 18),        # pata da frente
                 cone(300, 236, 316, 262, 30, 22), circle(320, 264, 20),        # traseira
                 curve((330, 200), (380, 190), (372, 120), (410, 92), 16, 9), k=18)
    board = big_pencil(92, 318, 300, -6, 26)
    speed = line("M40 250 h40 M24 274 h50 M52 226 h26", 4, COB)
    scene("pose-surf", 480, 360, [speed, board, (body, GATO), of, (hh, RED), oh])


def pose_espreguica():
    hs, hh, of, oh = head(112, 256, 0.84, -14, "dormindo", hat_rot=-36, hat_dx=-26, hat_dy=-50)
    body = union(cone(160, 276, 300, 196, 46, 62), hs,
                 cone(150, 300, 50, 316, 20, 15), circle(46, 314, 16),            # patas da frente esticadas
                 cone(310, 220, 330, 312, 36, 20), circle(334, 316, 19),          # traseira
                 curve((330, 170), (390, 120), (320, 70), (372, 40), 15, 9), k=18)
    deco = line("M20 300 l-8 -4 M22 316 l-10 0", 2.6, TINTA) + line("M386 92 l12 -4 M390 108 l12 2", 3, GEMA)
    scene("pose-espreguica", 480, 360, [deco, (body, GATO), of, (hh, RED), oh,
                                         pencil(70, 336, 120, -4, 12)])


def pose_barco():
    hs, hh, of, oh = head(232, 168, 0.84, 6, "feliz")
    body = union(ellipse(240, 248, 92, 52), hs, cone(300, 236, 336, 214, 18, 15), circle(338, 212, 15), k=16)
    boat = (f'<path d="M48 236 L432 236 L372 312 L108 312 Z" fill="{GEMA}"/>'
            f'<path d="M48 236 L170 236 L200 312 L108 312 Z" fill="#F0B020"/>'
            + line("M232 254 h120 M240 270 h100 M248 286 h80", 2.4, "#C98A12")
            + f'<circle cx="262" cy="254" r="5" fill="{TINTA}"/><circle cx="300" cy="270" r="5" fill="{TINTA}"/>')
    mast = (pencil(388, 220, 170, -90, 12)
            + f'<path d="M388 60 C410 70 420 52 446 64 L446 96 C420 84 410 102 388 92 Z" fill="{RED}"/>')
    waves = line("M20 330 q20 -14 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0", 4, COB)
    scene("pose-barco", 480, 360, [mast, (body, GATO), of, (hh, RED), oh, boat, waves])


def pose_dormindo():
    stack, top = books(240, 340, [(260, 40, RED, 0), (230, 34, GEMA, 14), (250, 36, "#1FCB8B", -6)])
    hs, hh, of, oh = head(150, top - 44, 0.76, 8, "dormindo", hat_rot=8, hat_dx=10, hat_dy=-46)
    body = union(ellipse(260, top - 40, 110, 46), hs,
                 curve((350, top - 30), (392, top - 10), (380, top + 50), (400, top + 92), 14, 9),
                 cone(150, top - 6, 100, top - 2, 16, 14), k=16)
    zz = (f'<text x="330" y="{top - 110}" font-family="Fredoka" font-weight="700" font-size="34" fill="{TINTA}">z</text>'
          f'<text x="356" y="{top - 140}" font-family="Fredoka" font-weight="700" font-size="24" fill="{TINTA}">z</text>')
    scene("pose-dormindo", 480, 360, [stack, (body, GATO), of, (hh, RED), oh, zz])


FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts", "fredoka-700.ttf")


def wordmark_path(text="vestibularr", size=200, grow=0.014, bounce=None, track=0.05):
    """Letras "gordinhas": Fredoka 700 dilatada e suavizada; cada letra com leve pulo/rotação.
    Retorna (path, largura, altura) em unidades onde a altura-x ~ size*0.5."""
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
    from scipy import ndimage
    from sdf import array_path
    px = 4  # pixels por unidade
    fnt = ImageFont.truetype(FONT, size * px)
    bounce = bounce or [0, -3, 2, -2, 3, -2, 2, -3, 1, -1, 2]
    rots = [-6, 4, -3, 5, -4, 3, -5, 4, -3, 6, -4]
    W = int(size * px * (len(text) * 0.62 + 1)); H = int(size * px * 1.6)
    mask = Image.new("L", (W, H), 0)
    x = size * px * 0.3
    for i, ch in enumerate(text):
        g = Image.new("L", (size * px * 2, size * px * 2), 0)
        ImageDraw.Draw(g).text((size * px * 0.5, size * px * 0.3), ch, font=fnt, fill=255)
        g = g.rotate(rots[i % len(rots)], resample=Image.BICUBIC, center=(size * px, size * px))
        mask.paste(255, (int(x - size * px * 0.5), int(bounce[i % len(bounce)] * px * size / 100)), g)
        x += fnt.getlength(ch) * (1 + track)
    m = np.array(mask) > 127
    din = ndimage.distance_transform_edt(m); dout = ndimage.distance_transform_edt(~m)
    F = dout - din - grow * size * px
    F = ndimage.gaussian_filter(F, size * px * 0.008)
    ys, xs = np.where(F < 0)
    F = F[max(ys.min() - 4, 0):ys.max() + 4, max(xs.min() - 4, 0):xs.max() + 4]
    cols = slice(int(F.shape[1] * 0.80), int(F.shape[1] * 0.97))
    top = np.where((F[:, cols] < 0).any(axis=1))[0].min() / px     # topo da altura-x em "arr"
    return array_path(F, px, step=3.5), F.shape[1] / px, F.shape[0] / px, top


def marca(name="marca", letter=TINTA, bg="#FFFFFF"):
    d, ww, hh_, top = wordmark_path()
    pad = 40
    W, H = int(ww + pad * 2), int(hh_ + 170)
    oy = H - hh_ - pad
    # gato espiando por trás do "arr": cabeça + patas por cima das letras
    cx, ty = pad + ww * 0.86, oy + top
    hs, hhat, of, oh = head(cx, ty - 50, 1.0, 6, "cool")
    cat = union(hs, ellipse(cx, ty + 4, 66, 30), k=14)
    paws = union(circle(cx - 50, ty + 6, 18), circle(cx + 58, ty + 8, 18), k=4)
    cat_path = to_path(cat, W, H)
    paw_path = to_path(paws, W, H)
    word = f'<path d="{d}" transform="translate({pad} {oy})" fill="{letter}" fill-rule="evenodd"/>'
    layers = [S(cat_path, GATO), S(d, letter, f'transform="translate({pad} {oy})" fill-rule="evenodd" stroke="{bg}" stroke-width="7" paint-order="stroke"'),
              S(paw_path, GATO),
              line(f"M{cx-56} {ty+12} l1 -7 M{cx-45} {ty+12} l0 -7 M{cx+53} {ty+14} l0 -7 M{cx+64} {ty+14} l-1 -7", 2.4),
              of, (hhat, RED), oh]
    scene(name, W, H, layers, bg)


if __name__ == "__main__":
    which = sys.argv[2:] or ["rosto"]
    if "rosto" in which:
        rosto("rosto", "cool")
        rosto("rosto-feliz", "feliz")
    if "marca" in which:
        marca()
        marca("marca-azul", COB)
    if "poses" in which:
        pose_surf(); pose_espreguica(); pose_barco(); pose_dormindo()
