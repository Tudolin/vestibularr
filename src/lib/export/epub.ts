import "server-only";
import JSZip from "jszip";
import type { Element, Root } from "hast";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { chapters, questionMeta, type ExportContent, type ExportQuestion } from "./types";

/**
 * EPUB 3 (com toc.ncx para leitores antigos): capa de texto, capítulos por disciplina, gabarito e resoluções
 * com links de ida e volta. As figuras são baixadas e embutidas (o livro funciona sem internet, inclusive no Kindle).
 */

const MEDIA: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };
const MAX_IMAGE = 4 * 1024 * 1024;
const MAX_TOTAL = 60 * 1024 * 1024;

const schema = {
  ...defaultSchema,
  protocols: { ...defaultSchema.protocols, src: ["http", "https"], href: ["http", "https", "mailto"] },
  attributes: { ...defaultSchema.attributes, img: ["src", "alt"] },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Images = { map: Map<string, string | null>; files: { path: string; type: string; data: Uint8Array }[]; total: number };

/** Markdown → XHTML válido (o EPUB é XML); troca cada imagem pelo arquivo embutido. */
function toXhtml(md: string, imgs: Images): string {
  const rewrite = () => (tree: Root) => {
    visit(tree, "element", (el: Element, index, parent) => {
      if (el.tagName !== "img") return;
      const local = imgs.map.get(String(el.properties?.src ?? ""));
      if (local) el.properties = { src: local, alt: String(el.properties?.alt ?? "") || "figura" };
      else if (parent && typeof index === "number") parent.children[index] = { type: "element", tagName: "em", properties: {}, children: [{ type: "text", value: "[figura indisponível — veja no app]" }] };
    });
  };
  const html = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeSanitize, schema).use(rewrite)
    .use(rehypeStringify, { closeSelfClosing: true, characterReferences: { useNamedReferences: false } }).processSync(md ?? "");
  return String(html);
}

function imageUrls(q: ExportQuestion): string[] {
  const inMd = (s: string) => [...(s ?? "").matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?/g)].map((m) => m[1]);
  return [
    ...inMd(q.statement_md), ...(q.images ?? []).filter((u) => !q.statement_md.includes(u)),
    ...q.alternatives.flatMap((a) => [...inMd(a.text_md), ...(a.image_url ? [a.image_url] : [])]),
    ...inMd(q.explanation_md ?? ""),
  ];
}

async function fetchImages(urls: string[], origin: string): Promise<Images> {
  const imgs: Images = { map: new Map(), files: [], total: 0 };
  const unique = [...new Set(urls)].slice(0, 400);
  let i = 0;
  // de 6 em 6 para não demorar nem sobrecarregar a origem
  for (let k = 0; k < unique.length; k += 6) {
    await Promise.all(unique.slice(k, k + 6).map(async (u) => {
      imgs.map.set(u, null);
      try {
        const abs = u.startsWith("/") && !u.startsWith("//") ? new URL(u, origin) : new URL(u);
        if (!/^https?:$/.test(abs.protocol)) return;
        const res = await fetch(abs, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) return;
        const ext = (abs.pathname.split(".").pop() ?? "").toLowerCase();
        const type = MEDIA[ext] ?? Object.entries(MEDIA).find(([, t]) => res.headers.get("content-type")?.startsWith(t))?.[1];
        if (!type) return;
        const data = new Uint8Array(await res.arrayBuffer());
        if (data.byteLength > MAX_IMAGE || imgs.total + data.byteLength > MAX_TOTAL) return;
        const name = `img${++i}.${Object.entries(MEDIA).find(([, t]) => t === type)![0]}`;
        imgs.total += data.byteLength;
        imgs.files.push({ path: `images/${name}`, type, data });
        imgs.map.set(u, `images/${name}`);
      } catch { /* figura fica como aviso no texto */ }
    }));
  }
  return imgs;
}

const page = (title: string, body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="pt-BR" xml:lang="pt-BR">
<head><meta charset="UTF-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
${body}
</body>
</html>`;

const CSS = `body { font-family: serif; line-height: 1.45; margin: 0 4%; }
h1 { font-size: 1.5em; margin: 1em 0 .5em; }
h2 { font-size: 1.1em; margin: 1.6em 0 .2em; page-break-after: avoid; }
.meta { font-size: .8em; color: #555; margin: 0 0 .6em; font-family: sans-serif; }
img { max-width: 100%; height: auto; }
ol.alts { list-style: none; padding: 0; margin: .6em 0; }
ol.alts li { margin: .35em 0; padding-left: 1.8em; text-indent: -1.8em; }
ol.alts li p { display: inline; margin: 0; }
.lbl { font-weight: bold; font-family: sans-serif; }
.ver { font-size: .85em; font-family: sans-serif; }
table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
td, th { border: 1px solid #999; padding: .25em .4em; text-align: center; }
.capa { text-align: center; margin-top: 30%; }
.capa p { color: #444; }
hr { border: 0; border-top: 1px solid #bbb; margin: 1.4em 0; }`;

export async function buildEpub(c: ExportContent, origin: string): Promise<Uint8Array> {
  const imgs = await fetchImages(c.questions.flatMap(imageUrls), origin);
  const caps = chapters(c.questions);
  const answers = c.with_answers && c.questions.some((q) => q.correct_label || q.explanation_md);
  const date = new Date(c.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const files: { id: string; href: string; title: string; xhtml: string; nav?: boolean }[] = [];
  files.push({ id: "capa", href: "capa.xhtml", title: "Capa", xhtml: page(c.title, `<div class="capa"><h1>${esc(c.title)}</h1><p>${c.questions.length} questões${answers ? " com gabarito e resoluções" : ""}</p><p>Vestibularr · ${date}</p></div>`) });

  caps.forEach((cap, i) => {
    const body = cap.questions.map((q) => {
      const alts = q.alternatives.length
        ? `<ol class="alts">${q.alternatives.map((a) => `<li><span class="lbl">${a.label})</span> ${toXhtml(a.text_md, imgs)}${a.image_url && imgs.map.get(a.image_url) ? `<img src="${imgs.map.get(a.image_url)}" alt="alternativa ${a.label}"/>` : ""}</li>`).join("")}</ol>`
        : "";
      const extra = (q.images ?? []).filter((u) => !q.statement_md.includes(u)).map((u) => imgs.map.get(u)).filter(Boolean).map((p) => `<p><img src="${p}" alt="figura"/></p>`).join("");
      return `<section id="q${q.n}"><h2>Questão ${q.n}</h2><p class="meta">${esc(questionMeta(q))}</p>${toXhtml(q.statement_md, imgs)}${extra}${alts}${answers ? `<p class="ver"><a href="respostas.xhtml#r${q.n}">Ver resposta →</a></p>` : ""}</section><hr/>`;
    }).join("\n");
    files.push({ id: `cap${i + 1}`, href: `cap${i + 1}.xhtml`, title: cap.title, xhtml: page(cap.title, `<h1>${esc(cap.title)}</h1>\n${body}`) });
  });

  if (answers) {
    const chap = (n: number) => files.find((f) => f.id.startsWith("cap") && caps[Number(f.id.slice(3)) - 1]?.questions.some((q) => q.n === n))?.href ?? "cap1.xhtml";
    const rows = c.questions.map((q) => `<tr><td><a href="#r${q.n}">${q.n}</a></td><td>${q.correct_label ?? "—"}</td></tr>`).join("");
    const resol = c.questions.map((q) => `<section id="r${q.n}"><h2>Questão ${q.n} — resposta ${q.correct_label ?? "—"}</h2>${q.explanation_md ? toXhtml(q.explanation_md, imgs) : "<p><em>Sem resolução comentada.</em></p>"}<p class="ver"><a href="${chap(q.n)}#q${q.n}">← Voltar à questão</a></p></section>`).join("\n");
    files.push({ id: "respostas", href: "respostas.xhtml", title: "Gabarito e resoluções", xhtml: page("Gabarito e resoluções", `<h1>Gabarito</h1><table><tr><th>Questão</th><th>Resposta</th></tr>${rows}</table>\n<h1>Resoluções</h1>\n${resol}`) });
  }

  const nav = page("Sumário", `<nav epub:type="toc" id="toc"><h1>Sumário</h1><ol>${files.map((f) => `<li><a href="${f.href}">${esc(f.title)}</a></li>`).join("")}</ol></nav>`);
  const uid = `urn:uuid:${c.id}`;
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="pt-BR">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="uid">${uid}</dc:identifier>
<dc:title>${esc(c.title)}</dc:title>
<dc:language>pt-BR</dc:language>
<dc:creator>Vestibularr</dc:creator>
<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
<item id="css" href="style.css" media-type="text/css"/>
${files.map((f) => `<item id="${f.id}" href="${f.href}" media-type="application/xhtml+xml"/>`).join("\n")}
${imgs.files.map((f, i) => `<item id="im${i + 1}" href="${f.path}" media-type="${f.type}"/>`).join("\n")}
</manifest>
<spine toc="ncx">
${files.map((f) => `<itemref idref="${f.id}"/>`).join("\n")}
</spine>
</package>`;
  const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${uid}"/></head>
<docTitle><text>${esc(c.title)}</text></docTitle><navMap>
${files.map((f, i) => `<navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${esc(f.title)}</text></navLabel><content src="${f.href}"/></navPoint>`).join("\n")}
</navMap></ncx>`;

  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" }); // precisa ser o primeiro e sem compressão
  zip.file("META-INF/container.xml", `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  zip.file("OEBPS/content.opf", opf);
  zip.file("OEBPS/nav.xhtml", nav);
  zip.file("OEBPS/toc.ncx", ncx);
  zip.file("OEBPS/style.css", CSS);
  for (const f of files) zip.file(`OEBPS/${f.href}`, f.xhtml);
  for (const f of imgs.files) zip.file(`OEBPS/${f.path}`, f.data, { compression: "STORE" });
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
