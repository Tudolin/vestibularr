/**
 * Estimativa de nota do ENEM. O ENEM usa TRI (parâmetros de cada item, não públicos para um simulado
 * caseiro), então isto é uma APROXIMAÇÃO LINEAR: % de acertos mapeada para uma faixa de nota por área.
 * As faixas são editáveis (settings.enem_score_bands). Sempre rotular como "estimativa".
 */
export type Area = "linguagens" | "humanas" | "natureza" | "matematica";
export const AREAS: Area[] = ["linguagens", "humanas", "natureza", "matematica"];
export type Bands = Record<Area, [number, number]>;

export const DEFAULT_BANDS: Bands = {
  linguagens: [300, 800],
  humanas: [300, 820],
  natureza: [300, 850],
  matematica: [330, 950],
};

export const TRI_NOTICE =
  "O ENEM usa TRI (Teoria de Resposta ao Item): a nota real depende de quais questões você acerta, não só de quantas. Este valor é uma estimativa.";

export const TRI_OFFICIAL_NOTICE =
  "Nota estimada pela TRI com os parâmetros oficiais do INEP para cada questão que você fez. É uma estimativa: quanto mais questões, mais precisa.";

export function estimateArea(correct: number, total: number, band: [number, number]): number | null {
  if (total <= 0) return null;
  const pct = Math.min(Math.max(correct / total, 0), 1);
  return Math.round(band[0] + pct * (band[1] - band[0]));
}

export function estimateEnem(byArea: Partial<Record<Area, { correct: number; total: number }>>, bands: Bands = DEFAULT_BANDS) {
  const areas: Partial<Record<Area, number>> = {};
  for (const a of AREAS) {
    const v = byArea[a];
    const est = v ? estimateArea(v.correct, v.total, bands[a]) : null;
    if (est != null) areas[a] = est;
  }
  const vals = Object.values(areas);
  const average = vals.length ? Math.round(vals.reduce((s, n) => s + n, 0) / vals.length) : null;
  return { areas, average };
}

/** Nota ponderada Sisu: média ponderada das 4 áreas + redação pelos pesos do curso. */
export type SisuWeights = { linguagens: number; humanas: number; natureza: number; matematica: number; redacao: number };

export function sisuWeighted(scores: Partial<Record<Area | "redacao", number>>, w: SisuWeights): number | null {
  let sum = 0;
  let wsum = 0;
  for (const k of [...AREAS, "redacao"] as const) {
    const s = scores[k];
    if (s == null) return null; // falta uma nota: não dá para ponderar com honestidade
    sum += s * w[k];
    wsum += w[k];
  }
  return wsum === 0 ? null : Math.round((sum / wsum) * 100) / 100;
}
