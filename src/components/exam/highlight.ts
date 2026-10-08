/** Marca-texto por DOM: grava trechos selecionados e os envolve em <mark>. */

const MARK = "mark[data-hl]";

export function clearHighlights(root: HTMLElement) {
  root.querySelectorAll(MARK).forEach((m) => {
    const parent = m.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(m.textContent ?? ""), m);
    parent.normalize();
  });
}

/** Aplica cada trecho na primeira ocorrência ainda não marcada, em ordem do documento. */
export function applyHighlights(root: HTMLElement, snippets: string[]) {
  clearHighlights(root);
  snippets.forEach((snip, idx) => {
    if (!snip) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement?.closest(MARK) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      const at = node.data.indexOf(snip);
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + snip.length);
      const mark = document.createElement("mark");
      mark.dataset.hl = String(idx);
      mark.title = "Toque para remover o destaque";
      mark.className = "cursor-pointer rounded-sm bg-[#fde047] px-0.5 text-[#1a1a1a]";
      range.surroundContents(mark);
      break;
    }
  });
}

/** Quebra a seleção em pedaços por nó de texto (um trecho pode atravessar parágrafos). */
export function selectionSnippets(root: HTMLElement): string[] {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return [];
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return [];
  const out: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (!range.intersectsNode(n)) continue;
    const start = n === range.startContainer ? range.startOffset : 0;
    const end = n === range.endContainer ? range.endOffset : n.data.length;
    const piece = n.data.slice(start, end).trim();
    if (piece.length >= 2 && piece.length <= 500) out.push(piece);
  }
  return out;
}
