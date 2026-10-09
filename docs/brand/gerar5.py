"""Mascote v5 (Capitão Grafite), a partir do esboço do dono: gato "bloco" em pé, tricórnio preto com
as orelhas furando a aba, olhar determinado e lápis erguido como espada.

python3 docs/brand/gerar5.py <saida>
"""
import os
import sys
import numpy as np
import cairosvg
from sdf import circle, ellipse, cone, tube, poly, union, to_path

OUT = sys.argv[1] if len(sys.argv) > 1 else "svg-v5"
os.makedirs(OUT, exist_ok=True)

AZUL, CHAPEU, CREME, TINTA, GEMA, MAD, ROSA = "#1F4FBF", "#2E2B36", "#F4F6FF", "#13235A", "#F2BB2E", "#F7C99A", "#F4A6C6"


def line(d, w=1.6, c=CREME):
    return f'<path d="{d}" stroke="{c}" stroke-width="{w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'


def box(cx, cy, hw, hh, r_top, r_bot):
    """Retângulo arredondado com raios diferentes em cima e embaixo."""
    def f(x, y):
        r = np.where(y < cy, r_top, r_bot)
        qx = np.abs(x - cx) - hw + r
        qy = np.abs(y - cy) - hh + r
        return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r
    return f


def pencil(x, y, L, rot, w):
    return (f'<g transform="translate({x} {y}) rotate({rot})">'
            f'<rect x="0" y="{-w/2}" width="{L}" height="{w}" rx="1" fill="{GEMA}"/>'
            f'<rect x="0" y="{-w/2}" width="{L}" height="{w*0.33}" rx="1" fill="#FFD86A"/>'
            f'<path d="M{L} {-w/2} L{L+w*1.35} 0 L{L} {w/2} Z" fill="{MAD}"/>'
            f'<path d="M{L+w*0.95} {-w*0.15} L{L+w*1.35} 0 L{L+w*0.95} {w*0.15} Z" fill="{TINTA}"/>'
            f'<rect x="{-w*0.7}" y="{-w/2}" width="{w*0.75}" height="{w}" fill="#C9CCD9"/>'
            f'<rect x="{-w*1.7}" y="{-w/2}" width="{w*1.1}" height="{w}" rx="{w*0.35}" fill="{ROSA}"/></g>')


# ---------- partes (coordenadas da cena, ~260 x 200) ----------
def corpo():
    tronco = union(box(154, 246, 66, 66, 42, 12),
                   cone(112, 188, 108, 148, 17, 5),                           # orelha de trás (aparece entre a aba e a copa)
                   k=8)
    return union(tronco, braco(), k=14)


def braco():
    return union(cone(214, 252, 242, 212, 12, 9), circle(246, 205, 12.5), k=6)


def orelha_frente():
    return cone(205, 190, 203, 150, 18, 5)


def chapeu():
    copa = union(ellipse(146, 156, 38, 22), ellipse(132, 146, 15, 10), ellipse(160, 145, 14, 9), k=7)
    faixa = poly([(92, 178), (112, 166), (182, 164), (226, 172), (214, 196), (98, 192)], r=5)
    aba_e = tube([(80, 146), (84, 166), (94, 184), (118, 194), (150, 197)], 4, 11)
    aba_d = tube([(150, 197), (190, 197), (216, 190), (238, 172), (262, 146)], 11, 3.5)
    return union(copa, faixa, aba_e, aba_d, k=8)


def caveira(x, y, s=1):
    return (f'<g transform="translate({x} {y}) scale({s})">'
            + line("M-11 7 L11 -1 M-11 -1 L11 7", 2.6)
            + f'<circle cx="0" cy="-5" r="8" fill="{CREME}"/><rect x="-4.6" y="0" width="9.2" height="6.5" rx="2" fill="{CREME}"/>'
            f'<circle cx="-3" cy="-5.4" r="2.3" fill="{CHAPEU}"/><circle cx="3" cy="-5.4" r="2.3" fill="{CHAPEU}"/>'
            f'<path d="M-1 -1.4 L1 -1.4 L0 0.4 Z" fill="{CHAPEU}"/></g>')


def rosto(mood="bravo"):
    out = []
    if mood == "bravo":     # sobrancelha embutida: topo inclinado para o centro
        out.append(f'<path d="M99 219 L125 225 C126 236 119 241 112 240 C104 239 99 231 99 219 Z" fill="{CREME}"/>')
        out.append(f'<path d="M163 219 L137 225 C136 236 143 241 150 240 C158 239 163 231 163 219 Z" fill="{CREME}"/>')
        out.append(f'<circle cx="116" cy="230" r="4.2" fill="{TINTA}"/><circle cx="146" cy="230" r="4.2" fill="{TINTA}"/>')
        out.append(f'<circle cx="117.4" cy="228.6" r="1.3" fill="{CREME}"/><circle cx="147.4" cy="228.6" r="1.3" fill="{CREME}"/>')
    elif mood == "feliz":
        out.append(line("M101 232 C105 222 119 222 123 232 M139 232 C143 222 157 222 161 232", 3.2))
    # nariz (contorno) e boquinha em "3"
    out.append(f'<path d="M127 244 L136 244 L131.5 249 Z" fill="none" stroke="{CREME}" stroke-width="1.5" stroke-linejoin="round"/>')
    if mood == "feliz":
        out.append(f'<path d="M125 253 C126 262 137 262 138 253 Z" fill="#F2423B"/>')
    else:
        out.append(line("M131.5 249 L131.5 252 M129.5 252.5 C133.5 252 134 255.5 130.5 256 C134 256.5 133.5 260 129.5 259.5", 1.5))
    return "".join(out)


def mascote(mood="bravo"):
    """Retorna lista de camadas (sdf, cor) | svg."""
    return [
        (corpo(), AZUL),
        (chapeu(), CHAPEU),
        caveira(146, 170, 1.05),
        (orelha_frente(), AZUL),
        line("M199 180 L202 160 L206 174 L209 166", 1.4),                  # pelinho da orelha
        pencil(232, 170, 72, 67, 8.5),
        (braco(), AZUL),
        line("M240 199 l2 5 M247 197 l1 5", 1.3),                          # dedinhos segurando o lápis
        rosto(mood),
    ]


def render(name, layers, vb=(66, 120, 210, 205), bg="#FFFFFF", rx=0, out_w=840):
    x0, y0, w, h = vb
    body = [f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" rx="{rx}" fill="{bg}"/>'] if bg else []
    for L in layers:
        if isinstance(L, str):
            body.append(L)
        else:
            f, fill = L
            body.append(f'<path d="{to_path(f, w, h, res=8, step=2.2, x0=x0, y0=y0)}" fill="{fill}"/>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {w} {h}" width="{w*2}" height="{h*2}">'
           + "".join(body) + "</svg>")
    with open(f"{OUT}/{name}.svg", "w") as fh:
        fh.write(svg)
    cairosvg.svg2png(bytestring=svg.encode(), write_to=f"{OUT}/{name}.png", output_width=out_w)
    print(name)


if __name__ == "__main__":
    render("grafite", mascote("bravo"))
    render("grafite-feliz", mascote("feliz"))
    render("grafite-icone", mascote("bravo"), vb=(46, 98, 246, 246), bg=GEMA, rx=54)
