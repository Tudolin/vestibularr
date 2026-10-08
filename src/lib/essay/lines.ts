/**
 * Estimativa de linhas manuscritas a partir do texto digitado.
 * Folha do ENEM/UFPR: ~75 caracteres por linha (letra média). Cada parágrafo começa em linha nova.
 * É uma estimativa: a letra de cada um muda o resultado — por isso a UI fala "≈ N linhas".
 */
export const CHARS_PER_LINE = 75;

export function estimateLines(text: string, charsPerLine = CHARS_PER_LINE): number {
  const paras = text.replace(/\r/g, "").split("\n").map((p) => p.trim()).filter(Boolean);
  return paras.reduce((n, p) => n + Math.max(1, Math.ceil(p.length / charsPerLine)), 0);
}

export function wordCount(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length;
}

export type LineStatus = "ok" | "short" | "over";
export function lineStatus(lines: number, limit: number, min = 0): LineStatus {
  if (lines > limit) return "over";
  if (min && lines < min) return "short";
  return "ok";
}
