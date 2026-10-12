#!/usr/bin/env python3
"""
Extrai a 1ª fase (Conhecimentos Gerais) do vestibular da UFPR a partir do PDF oficial do NC/UFPR.

O caderno publicado pelo Núcleo de Concursos já traz o gabarito marcado (► antes da alternativa certa) e as
anuladas com * antes do número. Este script:
  - separa as questões por disciplina (e as 7 línguas estrangeiras, 83–90);
  - mantém o texto como markdown (com sobrescrito/subscrito, itálico e textos de referência compartilhados);
  - recorta como imagem (PNG) o que não vira texto confiável: figuras, gráficos, tabelas e parágrafos com fórmulas
    do editor de equações (que o PDF codifica com glifos trocados);
  - grava data/ufpr/ufpr-<ano>.json no formato de importação e as figuras em public/questoes/ufpr/<ano>/.

Uso:  pip install pymupdf  &&  python3 scripts/ufpr-provas.py [--years 2024,2025] [--pdf-dir pasta]
      python3 scripts/ufpr-provas.py --concursos      # concursos do NC/UFPR -> data/concursos/<slug>.json
Sem --pdf-dir, baixa os PDFs do portal do NC/UFPR.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import unicodedata
import urllib.request
from dataclasses import dataclass, field

import pymupdf
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SOURCES = {
    2020: "https://servicos.nc.ufpr.br/documentos/PS2020/provas1fase/ps2020_conhecimentos_gerais.pdf",
    2022: "https://servicos.nc.ufpr.br/documentos/PS2022/provas/Geral.pdf",
    2023: "https://servicos.nc.ufpr.br/documentos/ps2023/provas/Geral.pdf",
    2024: "https://servicos.nc.ufpr.br/documentos/ps2024/provas/Geral.pdf",
    2025: "https://servicos.nc.ufpr.br/documentos/ps2025/provas/definitivo/Geral.pdf",
    2026: "https://servicos.nc.ufpr.br/documentos/ps2026/provas/definitivo/Geral.pdf",
}

# disciplina do caderno -> (área, matéria, idioma)
SUBJECTS = {
    "MATEMÁTICA": ("matematica", "Matemática", None),
    "FÍSICA": ("natureza", "Física", None),
    "QUÍMICA": ("natureza", "Química", None),
    "BIOLOGIA": ("natureza", "Biologia", None),
    "GEOGRAFIA": ("humanas", "Geografia", None),
    "HISTÓRIA": ("humanas", "História", None),
    "LÍNGUA PORTUGUESA": ("linguagens", "Língua Portuguesa", None),
    "LITERATURA BRASILEIRA": ("linguagens", "Literatura Brasileira", None),
    "FILOSOFIA": ("humanas", "Filosofia", None),
    "SOCIOLOGIA": ("humanas", "Sociologia", None),
    "ALEMÃO": ("linguagens", "Língua Estrangeira", "alemao"),
    "ESPANHOL": ("linguagens", "Língua Estrangeira", "espanhol"),
    "FRANCÊS": ("linguagens", "Língua Estrangeira", "frances"),
    "INGLÊS": ("linguagens", "Língua Estrangeira", "ingles"),
    "ITALIANO": ("linguagens", "Língua Estrangeira", "italiano"),
    "JAPONÊS": ("linguagens", "Língua Estrangeira", "japones"),
    "POLONÊS": ("linguagens", "Língua Estrangeira", "polones"),
}
SUBJECTS["?"] = (None, None, None)
LANG_TOPIC = {"alemao": "Alemão", "espanhol": "Espanhol", "frances": "Francês", "ingles": "Inglês",
              "italiano": "Italiano", "japones": "Japonês", "polones": "Polonês"}

Q_START = re.compile(r"^(\*{0,2})\s*(\d{1,2})\s*[-–]\s+")
ALT_START = re.compile(r"^(►?)\s*([A-Ea-e])\)\s*")
SUP = str.maketrans("0123456789+-−–()n", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁻⁻⁽⁾ⁿ")
SUB = str.maketrans("0123456789+-−–()", "₀₁₂₃₄₅₆₇₈₉₊₋₋₋₍₎")
SUP_OK = set("⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁽⁾ⁿ₀₁₂₃₄₅₆₇₈₉₊₋₍₎")
SAFE_MATH = set("√−≤≥∈∉Δ∆Ωπ°±×÷·∘≠≈∞αβγδθλμσφωΣ→←↔⇌∠⊥∥%")
DPI = 144


def nfkc(ch: str) -> str:
    """Letras matemáticas (𝒙, 𝑷) viram letras comuns."""
    if ord(ch) < 0x250:
        return ch  # ª, º, ², ° ficam como estão
    n = unicodedata.normalize("NFKC", ch)
    return n if len(n) == 1 else ch


def bad_glyph(ch: str) -> bool:
    """Glifo do editor de equações que o PDF mapeou para outro alfabeto (ex.: '=' vira 'ൌ')."""
    o = ord(ch)
    if o == 0xFFFD:
        return True
    if o < 0x250 or ch in SAFE_MATH or ch.isspace():
        return False
    n = nfkc(ch)
    if n != ch and ord(n) < 0x250:
        return False
    if 0x2000 <= o <= 0x2BFF and o not in (0x20D7,):  # pontuação e símbolos gerais
        return False
    return 0x0590 <= o <= 0x1FFF or 0xE000 <= o <= 0xF8FF or o == 0x20D7


# ---------------------------------------------------------------- estrutura da página

@dataclass
class Seg:
    """Uma linha do PDF (um trecho contínuo de texto)."""
    page: int
    x0: float
    y0: float
    x1: float
    y1: float
    spans: list
    text: str

    @property
    def cy(self):
        return (self.y0 + self.y1) / 2


@dataclass
class Row:
    page: int
    segs: list
    x0: float = 0
    y0: float = 0
    x1: float = 0
    y1: float = 0

    def __post_init__(self):
        self.segs.sort(key=lambda s: s.x0)
        self.x0 = min(s.x0 for s in self.segs)
        self.y0 = min(s.y0 for s in self.segs)
        self.x1 = max(s.x1 for s in self.segs)
        self.y1 = max(s.y1 for s in self.segs)

    @property
    def text(self):
        return " ".join(s.text.strip() for s in self.segs).strip()

    def tabular(self) -> bool:
        return any(b.x0 - a.x1 > 18 for a, b in zip(self.segs, self.segs[1:]))

    def mathy(self) -> bool:
        return any(bad_glyph(ch) for s in self.segs for sp in s.spans for ch in sp["text"])


@dataclass
class Fig:
    page: int
    x0: float
    y0: float
    x1: float
    y1: float
    labels: list = field(default_factory=list)

    @property
    def text(self):
        return ""


def rect_union(a, b):
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def overlaps(a, b, pad=0.0):
    return not (a[2] + pad < b[0] or b[2] + pad < a[0] or a[3] + pad < b[1] or b[3] + pad < a[1])


def page_items(doc, pno):
    page = doc[pno]
    W, H = page.rect.width, page.rect.height
    segs = []
    for b in page.get_text("dict", flags=pymupdf.TEXT_PRESERVE_WHITESPACE)["blocks"]:
        for l in b.get("lines", []):
            if abs(l["dir"][0] - 1) > 0.01:
                continue  # texto girado (rótulo "Geral" na lateral)
            spans = [s for s in l["spans"] if s["text"]]
            text = "".join(s["text"] for s in spans)
            if not text.strip():
                continue
            x0, y0, x1, y1 = l["bbox"]
            if y1 < 36 or y0 > H - 30:
                continue  # cabeçalho/rodapé
            segs.append(Seg(pno, x0, y0, x1, y1, spans, text))

    # figuras: imagens + desenhos vetoriais (gráficos, tabelas com bordas, esquemas)
    rects = []
    for info in page.get_image_info():
        r = info["bbox"]
        if (r[2] - r[0]) > 12 and (r[3] - r[1]) > 12 and r[1] > 30:
            rects.append(tuple(r))
    image_rects = list(rects)
    try:
        clusters = page.cluster_drawings(x_tolerance=4, y_tolerance=4)
    except Exception:
        clusters = []
    for r in clusters:
        w, h = r.x1 - r.x0, r.y1 - r.y0
        if h < 6 and w > 200:
            continue  # linha separadora / recorte
        if w < 8 or h < 8 or r.y0 < 30 or r.y1 > H - 25:
            continue
        rects.append((r.x0, r.y0, r.x1, r.y1))
    merged = True
    while merged:
        merged = False
        for i in range(len(rects)):
            for j in range(i + 1, len(rects)):
                if overlaps(rects[i], rects[j], 3):
                    rects[i] = rect_union(rects[i], rects[j])
                    del rects[j]
                    merged = True
                    break
            if merged:
                break
    def inside(sg, r):
        return r[0] - 2 <= (sg.x0 + sg.x1) / 2 <= r[2] + 2 and r[1] - 2 <= sg.cy <= r[3] + 2

    def keeps(r):
        """Moldura/realce em volta do texto da questão não é figura."""
        txt = [sg for sg in segs if inside(sg, r)]
        if any(Q_START.match(sg.text.strip()) and sg.x0 < 52 for sg in txt):
            return False
        if any(ALT_START.match(sg.text.replace("►", "").strip()) and sg.x0 < 360 for sg in txt):
            return False
        if any(overlaps(r, ir) for ir in image_rects):
            return True
        if len(txt) == 1 and (txt[0].x1 - txt[0].x0) > 0.3 * (r[2] - r[0]) and (r[3] - r[1]) < 3 * (txt[0].y1 - txt[0].y0):
            return False  # título numa caixa sombreada
        # só traços (sublinhados, caixas de texto): o texto ocupa quase tudo
        area = max((r[2] - r[0]) * (r[3] - r[1]), 1)
        covered = sum((sg.x1 - sg.x0) * (sg.y1 - sg.y0) for sg in txt)
        return covered / area < 0.45

    figs = [Fig(pno, *r) for r in rects if keeps(r)]

    # rótulos dentro da figura saem do texto
    rest = []
    for s in segs:
        host = next((f for f in figs if f.x0 - 2 <= (s.x0 + s.x1) / 2 <= f.x1 + 2 and f.y0 - 2 <= s.cy <= f.y1 + 2), None)
        if host:
            host.labels.append(s.text.strip())
        else:
            rest.append(s)

    # linhas na mesma altura = uma "linha visual" (células de tabela, alternativas lado a lado)
    rest.sort(key=lambda s: (s.cy, s.x0))
    rows: list[Row] = []
    for s in rest:
        host = None
        for r in rows[-3:]:
            ov = min(r.y1, s.y1) - max(r.y0, s.y0)
            hmin = min(r.y1 - r.y0, s.y1 - s.y0)
            if abs(r.segs[-1].cy - s.cy) < 3.2 or (ov > 0.45 * hmin and abs(r.segs[-1].cy - s.cy) < 0.6 * hmin):
                host = r
        if host:
            host.segs.append(s)
            host.__post_init__()
        else:
            rows.append(Row(pno, [s]))
    items = rows + figs
    # figura "ao lado" do enunciado começa acima da linha do número: ordena pelo centro dela
    items.sort(key=lambda it: ((it.y0 + it.y1) / 2 if isinstance(it, Fig) else it.y0, it.x0))
    return items


# ---------------------------------------------------------------- texto

MD_ESC = re.compile(r"([\\`*_\[\]<>])")


def span_md(row_size: float, row_cy: float, sp) -> str:
    t = "".join(nfkc(c) for c in sp["text"]).replace("►", "")
    if not t:
        return ""
    size = sp["size"]
    if size < row_size * 0.82 and t.strip():
        cy = (sp["bbox"][1] + sp["bbox"][3]) / 2
        tr = SUP if cy < row_cy - 0.8 else SUB
        conv = t.strip().translate(tr)
        if all(c in SUP_OK or c in " ,." for c in conv):
            return conv
        return ("^" if tr is SUP else "_") + "(" + t.strip() + ")"
    t = MD_ESC.sub(r"\\\1", t)
    italic = "Italic" in sp["font"] or "Oblique" in sp["font"]
    if italic and t.strip():
        lead = t[: len(t) - len(t.lstrip())]
        trail = t[len(t.rstrip()):]
        return f"{lead}*{t.strip()}*{trail}"
    return t


def row_md(row: Row) -> str:
    sizes = {}
    for s in row.segs:
        for sp in s.spans:
            if sp["text"].strip():
                sizes[round(sp["size"], 1)] = sizes.get(round(sp["size"], 1), 0) + len(sp["text"])
    main = max(sizes, key=sizes.get) if sizes else 10
    cy = None
    parts = []
    for s in row.segs:
        big = [sp for sp in s.spans if sp["size"] >= main * 0.82 and sp["text"].strip()]
        cy = (sum((sp["bbox"][1] + sp["bbox"][3]) / 2 for sp in big) / len(big)) if big else s.cy
        parts.append("".join(span_md(main, cy, sp) for sp in s.spans))
    out = " ".join(p.strip() for p in parts)
    out = re.sub(r"\*\s*\*", "", out)  # itálicos colados
    return re.sub(r"[ \t]+", " ", out).strip()


def plain(row: Row) -> str:
    return re.sub(r"\s+", " ", "".join(nfkc(c) for c in row.text.replace("►", ""))).strip()


LIST_MARK = re.compile(r"^(\d{1,2}[.)]|[IVX]{1,4}\s*[–-]|[IVX]{1,4}[.)]|[•●▪–-]\s|\(\s*\)|\(\d\))")


def paragraphs(rows: list[Row]) -> list[list[Row]]:
    """Agrupa linhas em parágrafos (recuo, espaço vertical, linha curta, marcador de lista, tabela)."""
    out: list[list[Row]] = []
    if not rows:
        return out
    right = max(r.x1 for r in rows)
    for r in rows:
        if not out:
            out.append([r])
            continue
        prev = out[-1][-1]
        h = max(prev.y1 - prev.y0, 6)
        new = (
            r.page != prev.page
            or r.y0 - prev.y1 > 0.55 * h
            or prev.x1 < right - 45
            or LIST_MARK.match(plain(r))
            or (r.x0 - prev.x0 > 10 and not LIST_MARK.match(plain(out[-1][0])))
            or r.tabular() != prev.tabular()
            or (r.mathy() != prev.mathy() and not (r.mathy() and abs(r.y0 - prev.y1) < 2))
        )
        if new:
            out.append([r])
        else:
            out[-1].append(r)
    return out


def join_rows(rows: list[Row]) -> str:
    text = ""
    for r in rows:
        t = row_md(r)
        if not text:
            text = t
        elif text.endswith("-") and not text.endswith(" -"):
            text += t
        else:
            text += " " + t
    return text


# ---------------------------------------------------------------- recortes

class Cropper:
    def __init__(self, doc, rel: str):
        self.doc = doc
        self.rel = rel
        self.dir = os.path.join(ROOT, "public", "questoes", *rel.split("/"))
        os.makedirs(self.dir, exist_ok=True)
        self.count: dict[str, int] = {}
        self.done: dict[tuple, str] = {}

    def save(self, key: str, page: int, rect) -> str:
        """Recorta a região como PNG; a mesma região (texto-base compartilhado) reaproveita o arquivo."""
        k = (page, *(round(v) for v in rect))
        if k in self.done:
            return self.done[k]
        self.done[k] = url = self._save(key, page, rect)
        return url

    def _save(self, key: str, page: int, rect) -> str:
        n = self.count[key] = self.count.get(key, 0) + 1
        name = f"{key}-{n}.png"
        clip = pymupdf.Rect(rect[0] - 3, rect[1] - 4, rect[2] + 3, rect[3] + 4) & self.doc[page].rect
        pix = self.doc[page].get_pixmap(clip=clip, dpi=DPI)
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        colors = img.getcolors(1 << 16)
        if colors is not None and len(colors) <= 2048 and all(abs(c[1][0] - c[1][1]) < 12 and abs(c[1][1] - c[1][2]) < 12 for c in colors):
            img = img.convert("L").quantize(16)  # texto/fórmula em tons de cinza
        else:
            img = img.quantize(128, method=Image.Quantize.MEDIANCUT)
        img.save(os.path.join(self.dir, name), optimize=True)
        return f"/questoes/{self.rel}/{name}"


def bbox_of(items) -> tuple:
    r = (items[0].x0, items[0].y0, items[0].x1, items[0].y1)
    for it in items[1:]:
        r = rect_union(r, (it.x0, it.y0, it.x1, it.y1))
    return r


def alt_text(s: str, limit=400) -> str:
    s = "".join(" " if bad_glyph(c) else c for c in s)
    s = re.sub(r"\s+", " ", s).strip().replace("[", "(").replace("]", ")")
    return (s[: limit - 1] + "…") if len(s) > limit else s


def region_md(items, cropper: Cropper, key: str) -> tuple[str, list[str]]:
    """Markdown de uma região (linhas e figuras na ordem de leitura)."""
    blocks: list[str] = []
    images: list[str] = []
    buf: list[Row] = []

    def flush():
        for para in paragraphs(buf):
            if any(r.mathy() for r in para) or (para[0].tabular() and len(para) >= 2):
                by_page: dict[int, list] = {}
                for r in para:
                    by_page.setdefault(r.page, []).append(r)
                for pg, rs in by_page.items():
                    url = cropper.save(key, pg, bbox_of(rs))
                    images.append(url)
                    label = "Tabela" if rs[0].tabular() else "Trecho com fórmula"
                    blocks.append(f"![{label}: {alt_text(' '.join(plain(r) for r in rs))}]({url})")
            elif para[0].tabular():
                blocks.append(" | ".join(row_md(Row(para[0].page, [s])) for s in para[0].segs))
            else:
                blocks.append(join_rows(para))
        buf.clear()

    for it in items:
        if isinstance(it, Fig):
            flush()
            url = cropper.save(key, it.page, (it.x0, it.y0, it.x1, it.y1))
            images.append(url)
            lab = alt_text(" ".join(it.labels), 300)
            blocks.append(f"![Figura{': ' + lab if lab else ''}]({url})")
        else:
            buf.append(it)
    flush()
    md = "\n\n".join(b for b in blocks if b.strip())
    return md, images


# ---------------------------------------------------------------- caderno -> questões

REF = re.compile(r"quest(?:ão|ões)\s+((?:\d{1,2}\s*(?:,|e|a|à)\s*)*\d{1,2})", re.I)


def ref_numbers(text: str) -> set[int]:
    m = REF.search(text)
    if not m:
        return set()
    spec = m.group(1)
    nums = [int(n) for n in re.findall(r"\d{1,2}", spec)]
    if re.search(r"\d\s*(a|à)\s*\d", spec) and len(nums) >= 2:
        return set(range(nums[0], nums[-1] + 1))
    return set(nums)


@dataclass
class Q:
    number: int
    subject_key: str
    annulled: bool
    stem: list = field(default_factory=list)
    alts: list = field(default_factory=list)  # [letter, correct, label_x, label_end_x, items]
    shared: list = field(default_factory=list)


LANG_RANGE = {2022: (1, 4)}  # números das questões de língua estrangeira (padrão: 83–90)
COVER = re.compile(r"INSTRUÇÕES|RESPOSTAS|ASSINO DECLARANDO")


def parse(doc, year: int, subjects: dict, lang_range: tuple[int, int] = (83, 90)) -> tuple[list[Q], list[str]]:
    warnings: list[str] = []
    stream = []
    for p in range(len(doc)):
        if COVER.search(doc[p].get_text()):
            continue  # capa e folha de respostas
        stream.extend(page_items(doc, p))
    lang_lo, lang_hi = lang_range
    # "*" = anulada; "**" = resposta alterada (o ► já é o definitivo), exceto onde a nota diz que também é anulada
    full = "".join(pg.get_text() for pg in doc)
    double_annul = bool(re.search(r"\*\*\s*Questão anulada", full))

    subject = "?"  # anos sem cabeçalho por disciplina: a matéria vem depois, na classificação
    qs: list[Q] = []
    cur: Q | None = None
    used: set[str] = set()
    left = False  # já saiu das alternativas (o que vier é texto-base da próxima)
    pre: list = []  # texto entre questões (texto-base compartilhado)
    shared: list[dict] = []  # textos-base: {subject, nums, items, next_only}

    def close_pre():
        nonlocal pre
        if pre:
            head = " ".join(plain(i) for i in pre[:3] if isinstance(i, Row))
            nums = ref_numbers(head)
            shared.append({"subject": subject, "nums": nums, "items": list(pre), "next_only": not nums})
        pre = []

    def next_letter():
        return next((c for c in "ABCDE" if c not in used), None)

    def alt_hit(seg: Seg):
        m = ALT_START.match(seg.text.lstrip())
        if not m or not 40 <= seg.x0 <= 360:
            return None
        letter = m.group(2).upper()
        if letter in used:
            return None
        # em ordem, ou fora de ordem quando está na segunda coluna (A e D lado a lado)
        if letter == next_letter() or (seg.x0 > 300 and used):
            return m
        return None

    def done():
        return len(used) == 5

    for it in stream:
        if isinstance(it, Row):
            t = plain(it)
            if re.fullmatch(r"\d+/\d+", t) or re.match(r"^\*{1,2}\s*Questão (anulada|com resposta)", t):
                continue
            if len(re.findall(r"\b\d{2}\s*-", t)) >= 3:
                continue  # grade de respostas da capa
            if t.upper() == t and t in subjects and len(it.segs) == 1:
                close_pre()
                subject = t
                cur = None
                shared = []
                continue
            if t.upper() == t and "DISCURSIVA" in t:
                close_pre()
                break  # a questão discursiva (2022) não entra na 1ª fase objetiva
            m = Q_START.match(t)
            if m and it.x0 < 52 and (cur is None or cur.alts or int(m.group(2)) == cur.number + 1):
                if cur is not None and not done():
                    warnings.append(f"{year} {subject} q{cur.number}: {len(used)} alternativas")
                n = int(m.group(2))
                if subjects.get(subject, (0, 0, None))[2] and not lang_lo <= n <= lang_hi:
                    subject = "?"  # acabou a língua estrangeira (2022: as comuns vêm depois, sem cabeçalho)
                close_pre()
                cur = Q(n, subject, m.group(1) == "*" or (m.group(1) == "**" and double_annul))
                cur.shared = [sh["items"] for sh in shared if sh["subject"] == subject and (n in sh["nums"] or sh["next_only"])]
                shared = [sh for sh in shared if not sh["next_only"] and sh["nums"] and n < max(sh["nums"])]
                qs.append(cur)
                used = set()
                left = False
                # o resto da linha (depois de "NN - ") é o começo do enunciado
                segs = [Seg(x.page, x.x0, x.y0, x.x1, x.y1, x.spans, x.text) for x in it.segs]
                first = segs[0]
                strip = re.match(r"^\s*\*{0,2}\s*\d{1,2}\s*[-–]\s+", first.text)
                if strip:
                    first.spans = cut_spans(first.spans, strip.group(0))
                    first.text = "".join(sp["text"] for sp in first.spans)
                    if first.spans:
                        first.x0 = first.spans[0]["bbox"][0]
                segs = [x for x in segs if x.text.strip()]
                if segs:
                    cur.stem.append(Row(it.page, segs))
                continue
            if cur is None:
                pre.append(it)
                continue
            # alternativas (podem vir duas por linha)
            if any(alt_hit(x) for x in it.segs):
                for x in it.segs:
                    m = alt_hit(x)
                    if m:
                        letter = m.group(2).upper()
                        used.add(letter)
                        mark = m.group(1) == "►" or any("►" in sp["text"] for sp in x.spans)
                        label = seg_label = x.text[: len(x.text) - len(x.text.lstrip())] + m.group(0)
                        size = x.spans[-1]["size"] if x.spans else 10
                        end = x.x0 + pymupdf.get_text_length(label.replace("►", "► "), fontname="helv", fontsize=size)
                        cur.alts.append([letter, mark, x.x0, end, [], label])
                        sp_cut = cut_spans(x.spans, label)
                        if "".join(sp["text"] for sp in sp_cut).strip():
                            cur.alts[-1][4].append(Row(it.page, [Seg(x.page, end, x.y0, x.x1, x.y1, sp_cut, "".join(sp["text"] for sp in sp_cut))]))
                    elif cur.alts:
                        owner_alt(cur, x.x0)[4].append(Row(it.page, [x]))
                continue
            if cur.alts:
                lead = min(a[2] for a in cur.alts)
                last = cur.alts[-1][4][-1] if cur.alts[-1][4] else None
                if done() and (left or it.x0 < lead - 8 or (last is not None and it.y0 - last.y1 > 14 and it.page == last.page)):
                    left = True
                    pre.append(it)
                    continue
                # continuação de alternativa (ou célula de tabela da alternativa)
                for x in it.segs:
                    owner_alt(cur, x.x0)[4].append(Row(it.page, [x]))
                continue
            cur.stem.append(it)
        else:  # figura
            if cur is None:
                pre.append(it)
            elif cur.alts:
                lead = min(a[2] for a in cur.alts)
                if done() and (left or it.x0 < lead - 8):
                    left = True
                    pre.append(it)
                elif it.x0 > 280 and all(a[2] < 300 for a in cur.alts) and it.y0 < cur.alts[0][4][0].y0 if cur.alts[0][4] else False:
                    cur.stem.append(it)  # figura "ao lado" do enunciado, ao lado também das alternativas
                else:
                    owner_alt(cur, it.x0)[4].append(it)
            else:
                cur.stem.append(it)
    close_pre()
    return qs, warnings


def owner_alt(q: Q, x: float):
    """Alternativa dona de um trecho: a última iniciada na mesma coluna."""
    cols = sorted({round(a[2]) for a in q.alts})
    col = max([c for c in cols if c <= x + 12] or [cols[0]])
    same = [a for a in q.alts if round(a[2]) == col]
    return same[-1]


def cut_spans(spans, label):
    n = len(label)
    out = []
    for sp in spans:
        t = sp["text"]
        if n >= len(t):
            n -= len(t)
            continue
        sp = dict(sp)
        if n:
            shift = pymupdf.get_text_length(t[:n].replace("►", "> "), fontname="helv", fontsize=sp["size"])
            b = sp["bbox"]
            sp["bbox"] = (b[0] + shift, b[1], b[2], b[3])
        sp["text"] = t[n:]
        n = 0
        out.append(sp)
    return out


def redact_marks(doc):
    """Apaga o ► (gabarito) do PDF antes de recortar, para nenhuma imagem entregar a resposta."""
    for page in doc:
        hits = 0
        for b in page.get_text("rawdict")["blocks"]:
            for l in b.get("lines", []):
                for sp in l["spans"]:
                    for ch in sp["chars"]:
                        if ch["c"] == "►":
                            page.add_redact_annot(pymupdf.Rect(ch["bbox"]), fill=(1, 1, 1))
                            hits += 1
        if hits:
            page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)


def extract(pdf_path: str, rel: str, year: int, subjects: dict, lang_range=(83, 90), keep=lambda n: True):
    """Questões de um caderno: [{number, area, subject, topic?, language?, statement_md, images, alternatives, correct}]."""
    doc = pymupdf.open(pdf_path)
    cropper = Cropper(doc, rel)
    for f in os.listdir(cropper.dir):
        if f.endswith(".png"):
            os.remove(os.path.join(cropper.dir, f))
    qs, warnings = parse(doc, year, subjects, lang_range)
    redact_marks(doc)
    out = []
    skipped = []
    for q in qs:
        if not keep(q.number):
            continue
        area, subj, lang = subjects.get(q.subject_key, (None, None, None))
        key = f"q{q.number:02d}" + (f"-{lang}" if lang else "")
        if q.annulled:
            skipped.append(f"{key} (anulada)")
            continue
        if len(q.alts) != 5:
            warnings.append(f"{year} {key}: {len(q.alts)} alternativas")
            skipped.append(f"{key} (alternativas: {len(q.alts)})")
            continue
        correct = [a[0] for a in q.alts if a[1]]
        if len(correct) != 1:
            warnings.append(f"{year} {key}: gabarito {correct}")
            skipped.append(f"{key} (gabarito ilegível)")
            continue
        parts = []
        imgs: list[str] = []
        for sh in q.shared:
            md, im = region_md(sh, cropper, key + "-texto")
            parts.append(md)
            imgs += im
        # tabela cujas linhas são as alternativas: o cabeçalho e a tabela inteira viram imagem no enunciado
        tab_alts = all(a[4] and isinstance(a[4][0], Row) and len(a[4]) >= 2 and all(isinstance(x, Row) for x in a[4])
                       and len({round(x.y0) for x in a[4]}) == 1 for a in q.alts)
        stem = list(q.stem)
        table_img = None
        if tab_alts:
            head = []
            while stem and isinstance(stem[-1], Row) and (stem[-1].tabular() or stem[-1].x0 > q.alts[0][2] + 8):
                head.insert(0, stem.pop())
            box = bbox_of(head + [x for a in q.alts for x in a[4]] + [Row(q.alts[0][4][0].page, [Seg(q.alts[0][4][0].page, a[2], a[4][0].y0, a[3], a[4][0].y1, [], "")]) for a in q.alts])
            table_img = cropper.save(key + "-tabela", q.alts[0][4][0].page, box)
        md, im = region_md(stem, cropper, key)
        parts.append(md)
        imgs += im
        if table_img:
            hdr = " | ".join(plain(r) for r in head) if head else ""
            parts.append(f"![Tabela{': ' + alt_text(hdr, 300) if hdr else ''}]({table_img})")
            imgs.append(table_img)
        alts = []
        for letter, _, lx, lend, items, _label in q.alts:
            rows = [x for x in items if isinstance(x, Row)]
            figs = [x for x in items if isinstance(x, Fig)]
            if tab_alts:
                text = " | ".join(row_md(r) for r in sorted(rows, key=lambda r: r.x0))
                alts.append({"label": letter, "text_md": text})
                continue
            if figs or any(r.mathy() for r in rows):
                box = bbox_of(items)
                box = (max(box[0], lend - 1), box[1], box[2], box[3])
                pages = {x.page for x in items}
                url = cropper.save(f"{key}-{letter}", min(pages), box)
                imgs.append(url)
                text = alt_text(" ".join(plain(r) for r in rows), 300) if rows and not figs else ""
                alts.append({"label": letter, "text_md": "", "image_url": url, **({"_alt": text} if text else {})})
                continue
            ps = paragraphs(rows)
            alts.append({"label": letter, "text_md": "\n\n".join(join_rows(p) for p in ps)})
        statement = "\n\n".join(p for p in parts if p.strip())
        if not statement.strip():
            warnings.append(f"{year} {key}: enunciado vazio")
            skipped.append(f"{key} (enunciado vazio)")
            continue
        item = {
            "number": q.number,
            "area": area,
            "subject": subj,
            **({"topic": LANG_TOPIC[lang], "language": lang} if lang else {}),
            "statement_md": statement,
            "images": imgs,
            "alternatives": [{k: v for k, v in a.items() if not k.startswith("_")} for a in alts],
            "correct": correct[0],
            "_key": key,
        }
        out.append(item)
    if os.path.isdir(cropper.dir) and not os.listdir(cropper.dir):
        os.rmdir(cropper.dir)
    return out, warnings, skipped


def vestibular(year: int, pdf_path: str, pdf_url: str):
    qs, warnings, skipped = extract(pdf_path, f"ufpr/{year}", year, SUBJECTS, LANG_RANGE.get(year, (83, 90)))
    for q in qs:
        key = q.pop("_key")
        lang = q.get("language")
        q["external_id"] = f"ufpr-{year}-{key}"
        q["source_ref"] = f"NC/UFPR PS{year}, 1ª fase (Conhecimentos Gerais), questão {q['number']}" + (f" ({LANG_TOPIC[lang]})" if lang else "")
    exam = {"name": f"UFPR {year} — 1ª fase", "year": year, "format": "UFPR_2fases_ate_2026", "pdf_url": pdf_url, "questions": qs}
    return exam, warnings, skipped


# Concursos do NC/UFPR (nível médio). As questões 1–30 (Português, Raciocínio Matemático, Informática e Legislação)
# são as mesmas para todos os cargos do edital: entram uma vez e são ligadas a cada prova (mesmo external_id).
CONCURSOS = [
    {
        "slug": "ufpr-tae-2024",
        "title": "UFPR Técnico-Administrativo",
        "year": 2024,
        "edital": "109/2024",
        "base": "https://servicos.nc.ufpr.br/documentos/progepe2024/provas/definitivo/",
        "common_until": 30,
        "cargos": {
            "401": "Técnico de Laboratório (Biologia)",
            "402": "Técnico de Laboratório (Análises Clínicas)",
            "403": "Técnico em Contabilidade",
            "404": "Técnico em Enfermagem",
            "405": "Técnico em Farmácia",
            "406": "Técnico em Radiologia",
        },
    },
    {
        "slug": "ufpr-tae-2025",
        "title": "UFPR Técnico-Administrativo",
        "year": 2025,
        "edital": "102/2025",
        "base": "https://servicos.nc.ufpr.br/documentos/progepe2025/provas/definitivo/",
        "common_until": 30,
        "cargos": {
            "501": "Técnico de Laboratório (Industrial)",
            "502": "Técnico de Laboratório (Química)",
        },
    },
]
CONCURSO_SUBJECTS = {
    "LÍNGUA PORTUGUESA": (None, "Língua Portuguesa", None),
    "RACIOCÍNIO MATEMÁTICO": (None, "Raciocínio Matemático", None),
    "INFORMÁTICA": (None, "Informática", None),
    "LEGISLAÇÃO": (None, "Legislação", None),
}


def concursos(pdf_dir: str | None):
    os.makedirs(os.path.join(ROOT, "data", "concursos"), exist_ok=True)
    for c in CONCURSOS:
        exams = []
        common: list[dict] = []
        for i, (code, cargo) in enumerate(c["cargos"].items()):
            url = c["base"] + f"{code}.pdf"
            path = os.path.join(pdf_dir, f"{c['slug']}-{code}.pdf") if pdf_dir else os.path.join("/tmp", f"{c['slug']}-{code}.pdf")
            if not os.path.exists(path):
                urllib.request.urlretrieve(url, path)
            subjects = {**CONCURSO_SUBJECTS, "CONHECIMENTOS ESPECÍFICOS": (None, cargo, None)}
            first = i == 0
            qs, warnings, skipped = extract(path, f"concursos/{c['slug']}/{code}",
                                            c["year"], subjects, keep=(lambda n: True) if first else (lambda n, lim=c["common_until"]: n > lim))
            for q in qs:
                key = q.pop("_key")
                shared = q["number"] <= c["common_until"]
                q["external_id"] = f"{c['slug']}-comum-{key}" if shared else f"{c['slug']}-{code}-{key}"
                q["source_ref"] = f"NC/UFPR, edital {c['edital']} ({c['title']} {c['year']}), " + (
                    f"questão {q['number']} (comum a todos os cargos de nível médio)" if shared else f"{cargo}, questão {q['number']}")
                if shared:
                    common.append(q)
            own = [q for q in qs if q["number"] > c["common_until"]]
            exams.append({"name": f"{c['title']} {c['year']} — {cargo}", "year": c["year"], "pdf_url": url,
                          "questions": common + own})
            print(f"{c['slug']} {code} ({cargo}): {len(common)} comuns + {len(own)} específicas; puladas: {', '.join(skipped) or 'nenhuma'}")
            for w in warnings:
                print("  aviso:", w, file=sys.stderr)
        bundle = {"version": 1, "board": "CONCURSO", "exams": exams, "questions": []}
        with open(os.path.join(ROOT, "data", "concursos", f"{c['slug']}.json"), "w", encoding="utf-8") as fh:
            json.dump(bundle, fh, ensure_ascii=False, indent=1)
            fh.write("\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", default=",".join(str(y) for y in SOURCES))
    ap.add_argument("--pdf-dir", default=None, help="pasta com ps<ano>.pdf (e <slug>-<cargo>.pdf) já baixados")
    ap.add_argument("--concursos", action="store_true", help="extrai os concursos (CONCURSOS) em vez do vestibular")
    args = ap.parse_args()
    if args.concursos:
        return concursos(args.pdf_dir)
    os.makedirs(os.path.join(ROOT, "data", "ufpr"), exist_ok=True)
    for year in [int(y) for y in args.years.split(",") if y.strip()]:
        url = SOURCES[year]
        if args.pdf_dir:
            path = os.path.join(args.pdf_dir, f"ps{year}.pdf")
        else:
            path = os.path.join("/tmp", f"ufpr-ps{year}.pdf")
            if not os.path.exists(path):
                urllib.request.urlretrieve(url, path)
        exam, warnings, skipped = vestibular(year, path, url)
        bundle = {"version": 1, "board": "UFPR", "exams": [exam], "questions": []}
        dest = os.path.join(ROOT, "data", "ufpr", f"ufpr-{year}.json")
        with open(dest, "w", encoding="utf-8") as fh:
            json.dump(bundle, fh, ensure_ascii=False, indent=1)
            fh.write("\n")
        by_lang = {}
        for q in exam["questions"]:
            by_lang[q.get("language") or "comum"] = by_lang.get(q.get("language") or "comum", 0) + 1
        print(f"PS{year}: {len(exam['questions'])} questões {by_lang}; puladas: {', '.join(skipped) or 'nenhuma'}")
        for w in warnings:
            print("  aviso:", w, file=sys.stderr)


if __name__ == "__main__":
    main()
