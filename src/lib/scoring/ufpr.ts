/**
 * Pontuação do Vestibular UFPR 2027 (Edital 50/2026-NC/PROGRAP, itens 6.7, 6.11 e 9.9).
 *
 * Objetiva: 80 questões; até 2 disciplinas específicas por curso têm peso maior, definido pelo
 * número TOTAL de questões dessas disciplinas em conjunto (6.7.3.1): ≤5 → 3; 6–10 → 2,5; ≥11 → 2.
 * Demais questões: peso 1. Discursiva (CPT): 40 pontos (25 + 15).
 * Nota = (Σ acertos×peso + discursiva) / (Σ questões×peso + 40) × 1000, com 3 casas decimais (9.2.2, 9.9).
 */
export const UFPR_2027_SUBJECTS: Record<string, number> = {
  "Língua Portuguesa": 10,
  Biologia: 8,
  Física: 8,
  Geografia: 8,
  História: 8,
  Matemática: 8,
  Química: 8,
  "Língua Estrangeira Moderna": 7,
  "Literatura Brasileira": 5,
  Filosofia: 5,
  Sociologia: 5,
};
export const UFPR_CPT_MAX = 40;

export function specificWeight(totalSpecificQuestions: number): number {
  if (totalSpecificQuestions <= 0) return 1;
  if (totalSpecificQuestions <= 5) return 3;
  if (totalSpecificQuestions <= 10) return 2.5;
  return 2;
}

export type UfprInput = {
  /** acertos e total de questões por disciplina */
  bySubject: Record<string, { correct: number; total: number }>;
  /** até 2 disciplinas com peso diferenciado no curso */
  specificSubjects?: string[];
  /** pontos obtidos na discursiva (0–40) ou null se ainda não corrigida */
  discursive?: number | null;
  /** inclui a discursiva no denominador (prova completa) */
  includeDiscursive?: boolean;
};

export type UfprResult = { score: number; objectiveWeighted: number; objectiveMax: number; weight: number; max: number };

export function ufprScore(input: UfprInput): UfprResult {
  const specific = (input.specificSubjects ?? []).slice(0, 2);
  const totalSpecific = specific.reduce((n, s) => n + (input.bySubject[s]?.total ?? UFPR_2027_SUBJECTS[s] ?? 0), 0);
  const weight = specific.length ? specificWeight(totalSpecific) : 1;
  let got = 0;
  let max = 0;
  for (const [subject, v] of Object.entries(input.bySubject)) {
    const w = specific.includes(subject) ? weight : 1;
    got += v.correct * w;
    max += v.total * w;
  }
  const disc = input.includeDiscursive ? Math.min(Math.max(input.discursive ?? 0, 0), UFPR_CPT_MAX) : 0;
  const denom = max + (input.includeDiscursive ? UFPR_CPT_MAX : 0);
  const score = denom === 0 ? 0 : Math.round(((got + disc) / denom) * 1000 * 1000) / 1000;
  return { score, objectiveWeighted: got, objectiveMax: max, weight, max: denom };
}

/** Arredondamento da nota de cada questão discursiva (6.11.6): 4ª casa ≥5 sobe a 3ª. */
export function roundDiscursive(x: number) {
  return Math.round((x + Number.EPSILON) * 1000) / 1000;
}
