import { DEFAULT_BANDS, estimateArea, sisuWeighted, type Area, type Bands, type SisuWeights } from "./enem";
import { UFPR_2027_SUBJECTS, UFPR_CPT_MAX, specificWeight } from "./ufpr";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Aproxima nomes de disciplina do banco aos nomes oficiais do edital UFPR 2027. */
export function officialSubject(name: string): string | null {
  const n = norm(name);
  for (const off of Object.keys(UFPR_2027_SUBJECTS)) if (norm(off) === n) return off;
  if (/^(portugues|lingua portuguesa|gramatica|interpretacao)/.test(n)) return "Língua Portuguesa";
  if (/^literatura/.test(n)) return "Literatura Brasileira";
  if (/(ingles|espanhol|frances|alemao|italiano|japones|polones|lingua estrangeira)/.test(n)) return "Língua Estrangeira Moderna";
  if (/^matematica/.test(n)) return "Matemática";
  for (const off of Object.keys(UFPR_2027_SUBJECTS)) if (n.startsWith(norm(off))) return off;
  return null;
}

export type SubjectStat = { key: string; answered: number; correct: number };

/**
 * Nota UFPR 2027 estimada para um curso: aplica o % de acerto do aluno em cada disciplina à
 * distribuição oficial (80 questões), com o peso do curso (Anexo XX), e soma a CPT (% médio × 40).
 * Disciplinas sem dados usam o % geral do aluno — e isso é informado em `filledWithAverage`.
 */
export function ufprCourseEstimate(stats: SubjectStat[], specific: { subject: string; weight: number }[], cptPct: number | null) {
  const acc = new Map<string, { a: number; c: number }>();
  for (const s of stats) {
    const off = officialSubject(s.key);
    if (!off) continue;
    const cur = acc.get(off) ?? { a: 0, c: 0 };
    acc.set(off, { a: cur.a + s.answered, c: cur.c + s.correct });
  }
  const totalA = [...acc.values()].reduce((n, v) => n + v.a, 0);
  if (totalA === 0) return null;
  const avg = [...acc.values()].reduce((n, v) => n + v.c, 0) / totalA;
  const specificSubjects = specific.map((s) => s.subject);
  const w = specificSubjects.length ? specificWeight(specificSubjects.reduce((n, s) => n + (UFPR_2027_SUBJECTS[s] ?? 0), 0)) : 1;
  let got = 0, max = 0;
  const filled: string[] = [];
  for (const [subject, q] of Object.entries(UFPR_2027_SUBJECTS)) {
    const v = acc.get(subject);
    const pct = v && v.a > 0 ? v.c / v.a : avg;
    if (!v || v.a === 0) filled.push(subject);
    const weight = specificSubjects.includes(subject) ? w : 1;
    got += pct * q * weight;
    max += q * weight;
  }
  const cpt = cptPct == null ? null : Math.min(Math.max(cptPct, 0), 100) / 100 * UFPR_CPT_MAX;
  const score = Math.round(((got + (cpt ?? 0)) / (max + UFPR_CPT_MAX)) * 1000 * 1000) / 1000;
  return { score, weight: w, filledWithAverage: filled, cptMissing: cpt == null };
}

/** Sisu: notas por área estimadas (aproximação) + redação → média ponderada do curso. */
export function sisuCourseEstimate(
  byArea: { key: string; answered: number; correct: number }[],
  redacao: number | null,
  weights: SisuWeights,
  bands: Bands = DEFAULT_BANDS,
  /** Notas já estimadas por TRI (têm prioridade sobre a aproximação linear). */
  tri: Partial<Record<Area, number>> = {},
) {
  const areas: Partial<Record<Area | "redacao", number>> = {};
  for (const a of byArea) {
    const est = tri[a.key as Area] ?? estimateArea(a.correct, a.answered, bands[a.key as Area] ?? [300, 800]);
    if (est != null && a.key in bands) areas[a.key as Area] = est;
  }
  if (redacao != null) areas.redacao = redacao;
  const missing = (["linguagens", "humanas", "natureza", "matematica", "redacao"] as const).filter((k) => areas[k] == null);
  return { areas, missing, score: missing.length ? null : sisuWeighted(areas, weights) };
}

export const distanceToCutoff = (score: number | null, cutoff: number | null) =>
  score == null || cutoff == null ? null : Math.round((score - cutoff) * 100) / 100;
