import type { AnswersMap, FieldName, LocalAnswer, Op } from "./types";

export const emptyAnswer = (): LocalAnswer => ({
  choice: null,
  discursive_text: null,
  flagged: false,
  time_spent_ms: 0,
  strikes: [],
  highlights: [],
  field_ts: {},
});

/**
 * Aplica uma operação ao estado local com a MESMA regra do servidor:
 * última escrita por campo (ts maior vence; empate mantém o existente) e tempo vence o maior.
 * Pura e idempotente: aplicar a mesma op duas vezes dá o mesmo resultado.
 */
export function applyOp(answers: AnswersMap, op: Op): AnswersMap {
  if (op.field === "current_index") return answers;
  const cur = answers[op.question_id] ?? emptyAnswer();
  const field = op.field as FieldName;
  if (field === "time_spent_ms") {
    const v = Number(op.value);
    if (!(v > cur.time_spent_ms)) return answers;
    return { ...answers, [op.question_id]: { ...cur, time_spent_ms: v } };
  }
  const prev = cur.field_ts[field] ?? 0;
  if (op.ts <= prev) return answers;
  return {
    ...answers,
    [op.question_id]: { ...cur, [field]: op.value, field_ts: { ...cur.field_ts, [field]: op.ts } } as LocalAnswer,
  };
}

/** Estado do servidor + operações ainda não confirmadas (fila local) = o que o aluno deve ver. */
export function mergeServerAndOutbox(server: AnswersMap, pending: Op[]): AnswersMap {
  return [...pending].sort((a, b) => a.ts - b.ts).reduce(applyOp, server);
}

export function answerFromServer(row: {
  choice: string | null;
  discursive_text: string | null;
  flagged: boolean;
  time_spent_ms: number | string;
  strikes: unknown;
  highlights: unknown;
  field_ts: Record<string, number> | null;
}): LocalAnswer {
  return {
    choice: (row.choice as LocalAnswer["choice"]) ?? null,
    discursive_text: row.discursive_text,
    flagged: !!row.flagged,
    time_spent_ms: Number(row.time_spent_ms) || 0,
    strikes: Array.isArray(row.strikes) ? (row.strikes as LocalAnswer["strikes"]) : [],
    highlights: Array.isArray(row.highlights) ? (row.highlights as string[]) : [],
    field_ts: Object.fromEntries(Object.entries(row.field_ts ?? {}).map(([k, v]) => [k, Number(v)])),
  };
}

export type QuestionStatus = "answered" | "blank" | "flagged";
export const statusOf = (a?: LocalAnswer, isDiscursive = false): QuestionStatus =>
  a?.flagged ? "flagged" : (isDiscursive ? !!a?.discursive_text?.trim() : !!a?.choice) ? "answered" : "blank";
