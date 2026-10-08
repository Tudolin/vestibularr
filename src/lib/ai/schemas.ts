import { z } from "zod";

// Rigor onde importa (notas, critérios, degraus); textos curtos da IA ("Ok") não invalidam a correção.

export const ENEM_STEPS = [0, 40, 80, 120, 160, 200] as const;

const quote = z.string().trim().min(1).max(400);

/** Resposta da IA para redação ENEM. */
export const enemCorrectionSchema = z.object({
  annulled: z.object({ value: z.boolean(), reason: z.string().max(400).nullable().optional() }),
  competencies: z
    .array(
      z.object({
        key: z.enum(["c1", "c2", "c3", "c4", "c5"]),
        score: z.number().refine((n) => (ENEM_STEPS as readonly number[]).includes(n), "Nota deve ser 0, 40, 80, 120, 160 ou 200"),
        justification: z.string().min(2).max(1500),
      }),
    )
    .length(5)
    .refine((l) => new Set(l.map((c) => c.key)).size === 5, "Cada competência deve aparecer uma vez"),
  highlights: z.array(z.object({ quote, comment: z.string().min(1).max(500), criterion: z.string().max(20).optional(), type: z.enum(["erro", "acerto", "sugestao"]).default("erro") })).max(25),
  suggestions: z.array(z.string().min(1).max(500)).max(10),
  intervention: z.object({
    agent: z.object({ present: z.boolean(), quote: z.string().max(400).nullable().optional() }),
    action: z.object({ present: z.boolean(), quote: z.string().max(400).nullable().optional() }),
    means: z.object({ present: z.boolean(), quote: z.string().max(400).nullable().optional() }),
    purpose: z.object({ present: z.boolean(), quote: z.string().max(400).nullable().optional() }),
    detail: z.object({ present: z.boolean(), quote: z.string().max(400).nullable().optional() }),
  }),
  summary: z.string().min(2).max(1500),
});
export type EnemCorrection = z.infer<typeof enemCorrectionSchema>;

/** Resposta da IA para produção textual UFPR (critérios vêm da rubrica; notas em pontos). */
export const ufprCorrectionSchema = z.object({
  annulled: z.object({ value: z.boolean(), reason: z.string().max(400).nullable().optional() }),
  criteria: z.array(z.object({ key: z.string().min(1).max(30), score: z.number().min(0), justification: z.string().min(2).max(1500) })).min(1).max(12),
  highlights: z.array(z.object({ quote, comment: z.string().min(1).max(500), criterion: z.string().max(30).optional(), type: z.enum(["erro", "acerto", "sugestao"]).default("erro") })).max(25),
  suggestions: z.array(z.string().min(1).max(500)).max(10),
  mirror_comparison: z.string().max(1500).nullable().optional(),
  summary: z.string().min(2).max(1500),
});
export type UfprCorrection = z.infer<typeof ufprCorrectionSchema>;

/** Correção em lote de discursivas (uma chamada para várias respostas). */
export const discursiveBatchSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1),
    score: z.number().min(0),
    max: z.number().positive(),
    found: z.array(z.string().max(300)).max(15),
    missing: z.array(z.string().max(300)).max(15),
    feedback: z.string().min(1).max(1500),
  })).min(1).max(20),
});
export type DiscursiveBatch = z.infer<typeof discursiveBatchSchema>;

export const transcriptionSchema = z.object({
  text: z.string().max(12000),
  illegible: z.array(z.string().max(200)).max(50).default([]),
  confidence: z.enum(["alta", "media", "baixa"]),
});
export type Transcription = z.infer<typeof transcriptionSchema>;

/** Validações que dependem do contexto (rubrica/questão), além do schema. */
export function checkUfprAgainstRubric(c: UfprCorrection, rubric: { key: string; max: number }[], maxScore: number): string | null {
  const keys = rubric.map((r) => r.key).sort();
  const got = c.criteria.map((r) => r.key).sort();
  if (JSON.stringify(keys) !== JSON.stringify(got)) return `Critérios esperados: ${keys.join(", ")}; recebidos: ${got.join(", ")}`;
  for (const r of c.criteria) {
    const lim = rubric.find((x) => x.key === r.key)!.max * maxScore;
    if (r.score > lim + 1e-6) return `Critério ${r.key}: nota ${r.score} acima do máximo ${lim}`;
  }
  return null;
}

export function checkDiscursiveIds(b: DiscursiveBatch, ids: string[], maxById: Record<string, number>): string | null {
  const got = b.items.map((i) => i.id).sort();
  if (JSON.stringify(got) !== JSON.stringify([...ids].sort())) return `IDs esperados: ${ids.join(", ")}`;
  for (const i of b.items) if (i.score > (maxById[i.id] ?? 0) + 1e-6) return `Item ${i.id}: nota acima do máximo`;
  return null;
}

/** Mantém só os destaques cujo trecho existe de fato no texto (a IA às vezes "cita" o que não está lá). */
export function keepRealQuotes<T extends { quote: string }>(items: T[], text: string): T[] {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const t = norm(text);
  return items.filter((h) => t.includes(norm(h.quote)));
}
