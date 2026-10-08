import type { Bundle, ExamBundle, Question } from "./schema";

/** Divide um bundle em pedaços de até `size` questões (mantendo os metadados da prova em cada pedaço). */
export function chunkBundle(b: Bundle, size = 100): Bundle[] {
  const out: Bundle[] = [];
  const slices = <T,>(arr: T[]) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size));
  for (const e of b.exams) {
    const parts: Question[][] = e.questions.length ? slices(e.questions) : [[]];
    for (const part of parts) out.push({ version: 1, board: b.board, exams: [{ ...e, questions: part } as ExamBundle], questions: [] });
  }
  for (const part of slices(b.questions)) out.push({ version: 1, board: b.board, exams: [], questions: part });
  return out;
}
