export type Row = {
  question_id: string;
  area: string | null;
  subject: string | null;
  topic: string | null;
  kind: "objective" | "discursive";
  choice: string | null;
  correct: string | null;
  time_spent_ms: number;
};

export type Bucket = { key: string; correct: number; wrong: number; blank: number; total: number; pct: number; avgTimeMs: number };

/** Agrupa linhas respondidas por uma chave (área, disciplina, assunto). Só questões objetivas com gabarito. */
export function groupBy(rows: Row[], pick: (r: Row) => string | null | undefined): Bucket[] {
  const m = new Map<string, Bucket & { time: number }>();
  for (const r of rows) {
    if (r.kind !== "objective") continue;
    const key = pick(r) || "Sem classificação";
    const b = m.get(key) ?? { key, correct: 0, wrong: 0, blank: 0, total: 0, pct: 0, avgTimeMs: 0, time: 0 };
    b.total++;
    b.time += r.time_spent_ms;
    if (!r.choice) b.blank++;
    else if (r.correct && r.choice === r.correct) b.correct++;
    else b.wrong++;
    m.set(key, b);
  }
  return [...m.values()]
    .map(({ time, ...b }) => ({ ...b, pct: b.total ? Math.round((b.correct / b.total) * 100) : 0, avgTimeMs: b.total ? Math.round(time / b.total) : 0 }))
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}

export function totals(rows: Row[]) {
  const o = rows.filter((r) => r.kind === "objective");
  const correct = o.filter((r) => r.choice && r.correct && r.choice === r.correct).length;
  const blank = o.filter((r) => !r.choice).length;
  return { total: o.length, correct, blank, wrong: o.length - correct - blank, pct: o.length ? Math.round((correct / o.length) * 100) : 0 };
}
