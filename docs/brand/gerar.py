"""Gera a identidade visual do Vestibularr em SVG: mascote "Grafite" (gato pirata com lápis) e suas poses,
wordmark em curvas (Fredoka Bold, OFL) e as versões do logo.
   python3 docs/brand/gerar.py <fredoka-700.ttf> <pasta-de-saída>"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONT, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

C = dict(cobalto="#2F3CFF", tinta="#14123A", creme="#FFF7EA", gema="#FFC83D", coral="#FF6B5E",
         madeira="#FBD9A4", metal="#B8BDD9", branco="#FFFFFF", menta="#1FCB8B")

# ------------------------------------------------------------------ mascote
def mascot(pose="padrao", body=C["cobalto"], detail=C["branco"], ink=C["tinta"], hat=None, outline=C["branco"], props=True):
    hat = hat or ink
    g = []
    # contorno "adesivo" (sticker) atrás de tudo
    head = ("M56 214 C40 176 42 134 66 110 L56 58 C55 51 61 48 66 52 L102 86 "
            "C114 83 126 83 138 86 L174 52 C179 48 185 51 184 58 L174 110 "
            "C198 134 200 176 184 214 Z")
    pencil = (f'<g transform="rotate(-38 176 186)">'
              f'<rect x="150" y="181" width="78" height="20" rx="3" fill="{C["gema"]}"/>'
              f'<rect x="150" y="181" width="78" height="6" rx="3" fill="#FFDA70"/>'
              f'<path d="M228 181 L252 191 L228 201 Z" fill="{C["madeira"]}"/>'
              f'<path d="M244.5 187.8 L252 191 L244.5 194.2 Z" fill="{ink}"/>'
              f'<rect x="138" y="181" width="14" height="20" fill="{C["metal"]}"/>'
              f'<rect x="124" y="181" width="16" height="20" rx="6" fill="{C["coral"]}"/></g>')
    paw = f'<ellipse cx="170" cy="200" rx="21" ry="17" fill="{body}"/>' \
          f'<path d="M163 190 v8 M171 189 v9 M179 191 v7" stroke="{detail}" stroke-width="3.2" stroke-linecap="round"/>'
    if outline:
        g.append(f'<path d="{head}" fill="{outline}" stroke="{outline}" stroke-width="16" stroke-linejoin="round"/>')
        if props: g.append(f'<g stroke="{outline}" stroke-width="14" stroke-linejoin="round" stroke-linecap="round">{pencil.replace("fill=", "data-f=")}</g>'
                 .replace('<rect', '<rect fill="#fff"').replace('<path', '<path fill="#fff"'))
        if props: g.append(f'<ellipse cx="170" cy="200" rx="21" ry="17" fill="{outline}" stroke="{outline}" stroke-width="12"/>')
    g.append(f'<path d="{head}" fill="{body}"/>')
    # orelhas internas
    g.append(f'<path d="M66 68 L92 92 L72 104 Z M174 68 L148 92 L168 104 Z" fill="{detail}" opacity=".22"/>')
    # olhos por pose
    eyes = {
        "padrao":   lambda: eye(98, 146, 0, -3) + eye(142, 146, 0, -3),
        "comemora": lambda: f'<path d="M84 150 Q98 134 112 150 M128 150 Q142 134 156 150" stroke="{detail}" stroke-width="7" fill="none" stroke-linecap="round"/>',
        "pensa":    lambda: eye(98, 146, -6, -7) + eye(142, 146, -6, -7),
        "dorme":    lambda: f'<path d="M85 148 Q98 158 111 148 M129 148 Q142 158 155 148" stroke="{detail}" stroke-width="6" fill="none" stroke-linecap="round"/>',
        "surpresa": lambda: eye(98, 144, 0, 0, pr=5, r=19) + eye(142, 144, 0, 0, pr=5, r=19),
        "pisca":    lambda: eye(98, 146, 2, -3) + f'<path d="M129 148 Q142 138 155 148" stroke="{detail}" stroke-width="6.5" fill="none" stroke-linecap="round"/>',
    }
    def eye(cx, cy, dx, dy, pr=8.5, r=17):
        return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{detail}"/>'
                f'<circle cx="{cx+dx}" cy="{cy+dy}" r="{pr}" fill="{ink}"/>'
                f'<circle cx="{cx+dx+3}" cy="{cy+dy-3.5}" r="{max(2, pr*0.33)}" fill="{detail}"/>')
    g.append(eyes[pose]())
    # nariz + boca
    g.append(f'<path d="M114 166 h12 l-6 7 z" fill="{C["coral"]}" stroke="{C["coral"]}" stroke-width="3" stroke-linejoin="round"/>')
    if pose in ("comemora", "surpresa"):
        g.append(f'<path d="M110 177 Q120 194 130 177 Z" fill="{ink}"/><path d="M114 186 Q120 191 126 186" fill="{C["coral"]}"/>')
    else:
        g.append(f'<path d="M108 178 Q114 184 120 177 Q126 184 132 178" stroke="{detail}" stroke-width="4" fill="none" stroke-linecap="round"/>')
    # bigodes
    g.append(f'<path d="M62 166 h18 M64 177 l16 -4 M178 166 h-18 M176 177 l-16 -4" stroke="{detail}" stroke-width="3.6" stroke-linecap="round"/>')
    # chapéu pirata (bicorne) com caveirinha, entre as orelhas
    g.append(f'<g transform="rotate(-8 120 80)">'
             f'<path d="M58 100 C56 84 62 72 74 70 C82 70 86 74 90 76 C96 58 106 50 120 50 C134 50 144 58 150 76 C154 74 158 70 166 70 C178 72 184 84 182 100 C162 91 141 88 120 88 C99 88 78 91 58 100 Z" fill="{hat}"/>'
             f'<path d="M66 95 C84 89 102 86 120 86 C138 86 156 89 174 95" stroke="{C["gema"]}" stroke-width="4" fill="none" stroke-linecap="round"/>'
             f'<circle cx="120" cy="68" r="8.5" fill="{detail}"/><rect x="115" y="71.5" width="10" height="6" rx="2" fill="{detail}"/>'
             f'<circle cx="116.8" cy="67" r="2.3" fill="{hat}"/><circle cx="123.2" cy="67" r="2.3" fill="{hat}"/></g>')
    # lápis + pata (por cima)
    if props:
        g.append(pencil)
        g.append(paw)
    # extras por pose
    extra = {
        "comemora": f'<g fill="{C["gema"]}"><path d="M30 60 l5 10 l10 5 l-10 5 l-5 10 l-5 -10 l-10 -5 l10 -5 z"/></g>'
                    f'<circle cx="214" cy="54" r="6" fill="{C["coral"]}"/><rect x="22" y="128" width="10" height="10" rx="2" fill="{C["menta"]}" transform="rotate(20 27 133)"/>',
        "pensa": f'<circle cx="206" cy="58" r="20" fill="{C["branco"]}" stroke="{ink}" stroke-width="4"/><text x="206" y="68" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="28" fill="{ink}">?</text>'
                 f'<circle cx="188" cy="88" r="5" fill="{C["branco"]}" stroke="{ink}" stroke-width="3"/>',
        "dorme": f'<text x="196" y="70" font-family="Fredoka, sans-serif" font-weight="700" font-size="30" fill="{ink}">z</text><text x="214" y="46" font-family="Fredoka, sans-serif" font-weight="700" font-size="22" fill="{ink}">z</text>',
        "surpresa": f'<text x="200" y="74" font-family="Fredoka, sans-serif" font-weight="700" font-size="44" fill="{C["coral"]}">!</text>',
    }.get(pose, "")
    g.append(extra)
    return "".join(g)

def svg(content, vb="0 0 260 240", w=None, h=None, bg=None):
    size = f' width="{w}" height="{h}"' if w else ""
    bgr = f'<rect width="100%" height="100%" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"{size}>{bgr}{content}</svg>'

# ------------------------------------------------------------------ wordmark em curvas
font = TTFont(FONT)
gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
upm = font["head"].unitsPerEm
def word(text, size, x0, y0, fill, track=-0.02):
    s = size / upm; x = 0; paths = []
    for ch in text:
        gname = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[gname].draw(TransformPen(pen, (s, 0, 0, -s, x0 + x, y0)))
        paths.append(pen.getCommands())
        x += hmtx[gname][0] * s + track * size
    return f'<path d="{" ".join(paths)}" fill="{fill}"/>', x

def write(name, content):
    with open(os.path.join(OUT, name), "w") as f: f.write(content)

POSES = ["padrao", "comemora", "pensa", "pisca", "surpresa", "dorme"]
for p in POSES:
    write(f"mascote-{p}.svg", svg(mascot(p), "0 0 260 240"))
write("mascote-negativo.svg", svg(mascot("padrao", body=C["branco"], detail=C["cobalto"], hat=C["tinta"], outline=None), "0 0 260 240"))

# horizontal: mascote + "vestibularr"
wm, ww = word("vestibularr", 120, 290, 168, C["cobalto"])
write("logo-horizontal.svg", svg(f'<g>{mascot("padrao")}</g>{wm}', f"0 0 {int(300 + ww)} 240"))
wm2, ww2 = word("vestibularr", 120, 290, 168, C["branco"])
write("logo-horizontal-negativo.svg", svg(f'{mascot("padrao", body=C["branco"], detail=C["cobalto"], outline=None)}{wm2}', f"0 0 {int(300 + ww2)} 240", bg=C["cobalto"]))
# empilhado
wm3, ww3 = word("vestibularr", 64, 0, 0, C["cobalto"])
write("logo-empilhado.svg", svg(f'<g transform="translate({(ww3 - 260) / 2 + 10} 0)">{mascot("padrao")}</g><g transform="translate(10 300)">{wm3}</g>', f"0 0 {int(ww3 + 20)} 320"))
# só o wordmark
wm4, ww4 = word("vestibularr", 120, 6, 120, C["cobalto"])
write("wordmark.svg", svg(wm4, f"0 0 {int(ww4 + 12)} 150"))
# ícone do app (quadrado arredondado cobalto, mascote branco)
def icon(bg, body, detail):
    return (f'<defs><clipPath id="r"><rect width="512" height="512" rx="116"/></clipPath></defs>'
            f'<g clip-path="url(#r)"><rect width="512" height="512" fill="{bg}"/>'
            f'<g transform="translate(-8 41) scale(2.2)">{mascot("padrao", body=body, detail=detail, hat=C["tinta"], outline=None, props=False)}</g></g>')
write("icone-app.svg", svg(icon(C["cobalto"], C["branco"], C["cobalto"]), "0 0 512 512"))
write("icone-app-claro.svg", svg(icon(C["creme"], C["cobalto"], C["branco"]), "0 0 512 512"))
print("ok", sorted(os.listdir(OUT)))
