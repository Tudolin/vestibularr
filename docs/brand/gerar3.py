"""Mascote v3: silhueta contínua e fluida (gato deitado de costas, lápis nas patas). python3 docs/brand/gerar3.py <saida>"""
import sys, os
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
COB, TINTA, BR, GEMA, CORAL, MAD = "#2F3CFF", "#14123A", "#FFFFFF", "#FFC83D", "#FF6B5E", "#FBD9A4"

def line(d, w=5, c=BR):
    return f'<path d="{d}" stroke="{c}" stroke-width="{w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'

def pencil(x, y, L, rot, w=16):
    return (f'<g transform="translate({x} {y}) rotate({rot})">'
            f'<rect x="0" y="{-w/2}" width="{L}" height="{w}" rx="2" fill="{GEMA}"/>'
            f'<rect x="0" y="{-w/2}" width="{L}" height="{w*0.32}" rx="2" fill="#FFE08A"/>'
            f'<path d="M{L} {-w/2} L{L+w*1.3} 0 L{L} {w/2} Z" fill="{MAD}"/>'
            f'<path d="M{L+w*0.9} {-w*0.16} L{L+w*1.3} 0 L{L+w*0.9} {w*0.16} Z" fill="{TINTA}"/>'
            f'<rect x="{-w*0.8}" y="{-w/2}" width="{w*0.85}" height="{w}" fill="#B8BDD9"/>'
            f'<rect x="{-w*1.9}" y="{-w/2}" width="{w*1.2}" height="{w}" rx="{w*0.4}" fill="{CORAL}"/></g>')

def hat(cx, cy, s, rot):
    return (f'<g transform="translate({cx} {cy}) rotate({rot}) scale({s})">'
            f'<path d="M-70 12 C-62 0 -50 -8 -40 -10 C-34 -30 -16 -42 0 -42 C16 -42 34 -30 40 -10 C50 -8 62 0 70 12 '
            f'C46 2 24 -1 0 -1 C-24 -1 -46 2 -70 12 Z" fill="{TINTA}"/>'
            f'<path d="M-58 4 C-38 -3 -20 -5 0 -5 C20 -5 38 -3 58 4" stroke="{GEMA}" stroke-width="4.5" fill="none" stroke-linecap="round"/>'
            f'<circle cx="0" cy="-23" r="8" fill="{BR}"/><rect x="-5" y="-19" width="10" height="6" rx="2" fill="{BR}"/>'
            f'<circle cx="-3" cy="-24" r="2.2" fill="{TINTA}"/><circle cx="3" cy="-24" r="2.2" fill="{TINTA}"/></g>')

BODY = (
    "M84 300 C58 300 42 288 36 272 L16 268 L32 256 L14 244 L38 238 C38 232 40 228 44 224 "   # nuca + tufo da bochecha
    "L40 150 C40 142 47 139 52 144 L92 182 "     # orelha esquerda
    "C110 176 130 176 148 182 "                  # topo da cabeça
    "L186 146 C191 141 198 144 197 151 L190 214 "  # orelha direita
    "C198 226 206 232 214 230 "                  # bochecha → peito
    "C210 204 218 180 238 172 C254 166 268 178 262 192 C258 202 252 210 256 216 "   # pata dianteira 1 (dobrada)
    "C262 214 268 212 276 212 "
    "C276 186 286 162 306 154 C322 148 336 160 330 176 C326 186 320 204 322 214 "  # pata dianteira 2 (dobrada)
    "C352 214 392 206 420 194 "                  # barriga
    "C428 168 440 142 462 130 C478 122 496 118 506 104 C514 94 530 98 528 112 "     # coxa → joelho → pé erguido
    "C524 132 500 148 486 162 C480 172 478 186 480 200 "
    "C498 210 510 224 518 238 "                  # quadril → base da cauda
    "C556 236 586 214 590 176 C594 140 566 120 568 90 C570 62 596 50 614 62 "      # cauda (lado de fora) em S
    "C630 74 622 98 602 96 C592 95 590 88 594 82 C598 76 606 78 606 84 "            # ponta enrolada
    "C604 70 588 74 588 94 C590 116 618 136 616 178 "
    "C614 226 580 262 536 270 "
    "C534 284 528 296 512 300 Z"                 # traseira apoiada no chão
)

def mascote():
    g = []
    g.append(pencil(190, 214, 230, -24, 17))      # lápis atrás das patas, na diagonal
    g.append(f'<path d="{BODY}" fill="{COB}"/>')
    # linhas de anatomia (poucas e intencionais)
    g.append(line("M388 298 C394 262 420 238 456 236"))       # coxa
    g.append(line("M444 174 C452 158 464 148 478 142", 4))      # canela
    g.append(line("M240 184 l3 -7 M250 182 l1 -8 M306 166 l3 -7 M316 164 l1 -8", 3.6))   # dedos das patas
    g.append(line("M512 106 l6 6 M518 98 l7 4", 3.6))      # dedos da pata traseira
    g.append(line("M58 168 L70 196 M178 162 L170 196", 4.5))  # orelhas internas
    g.append(line("M232 232 C262 250 300 254 336 248", 4))    # peito/barriga
    # rosto: olhos semicerrados com atitude
    for ex in (92, 146):
        g.append(f'<path d="M{ex-16} 226 h32 a16 16 0 0 1 -32 0 Z" fill="{BR}"/>')
        g.append(f'<circle cx="{ex+4}" cy="233" r="7.5" fill="{TINTA}"/>')
        g.append(line(f"M{ex-18} 224 h36", 5, TINTA))
    g.append(f'<path d="M112 250 h14 l-7 7.5 z" fill="{CORAL}" stroke="{CORAL}" stroke-width="3" stroke-linejoin="round"/>')
    g.append(line("M105 264 Q112 271 119 263 Q126 271 133 264", 4))
    for x, y in ((90, 258), (82, 266), (92, 272), (150, 258), (158, 266), (148, 272)):
        g.append(f'<circle cx="{x}" cy="{y}" r="2.8" fill="{BR}"/>')
    g.append(hat(118, 168, 1.0, -8))
    return "".join(g)

HEAD = ("M123 302 C92 302 66 292 52 274 L30 270 L46 258 L28 246 L52 240 C50 234 50 228 52 222 "
        "L46 150 C46 142 53 139 58 144 L98 182 C114 177 132 177 148 182 L188 144 C193 139 200 142 200 150 "
        "L194 222 C196 228 196 234 194 240 L218 246 L200 258 L216 270 L194 274 C180 292 154 302 123 302 Z")

def rosto(mood="malandro"):
    g = [f'<path d="{HEAD}" fill="{COB}"/>', line("M62 166 L74 196 M184 166 L172 196", 4.5)]
    for ex in (96, 150):
        if mood == "feliz":
            g.append(line(f"M{ex-15} 232 Q{ex} 216 {ex+15} 232", 7))
        else:
            g.append(f'<path d="M{ex-16} 226 h32 a16 16 0 0 1 -32 0 Z" fill="{BR}"/>')
            g.append(f'<circle cx="{ex+4}" cy="233" r="7.5" fill="{TINTA}"/>')
            g.append(line(f"M{ex-18} 224 h36", 5, TINTA))
    g.append(f'<path d="M116 250 h14 l-7 7.5 z" fill="{CORAL}" stroke="{CORAL}" stroke-width="3" stroke-linejoin="round"/>')
    if mood == "feliz":
        g.append(f'<path d="M110 262 Q123 284 136 262 Z" fill="{TINTA}"/>')
    else:
        g.append(line("M109 264 Q116 271 123 263 Q130 271 137 264", 4))
    for x, y in ((94, 258), (86, 266), (96, 272), (152, 258), (160, 266), (150, 272)):
        g.append(f'<circle cx="{x}" cy="{y}" r="2.8" fill="{BR}"/>')
    g.append(hat(123, 168, 1.0, -8))
    return "".join(g)

for m in ("malandro", "feliz"):
    open(os.path.join(OUT, f"v3-rosto-{m}.svg"), "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 110 220 200">{rosto(m)}</svg>')
open(os.path.join(OUT, "v3.svg"), "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 30 650 290">{mascote()}</svg>')
print("ok")
