export type ExportQuestion = {
  id: string; n: number; board: string; year: number | null; number: number | null; area: string | null;
  subject: string | null; topic: string | null; statement_md: string; images: string[];
  alternatives: { label: string; text_md: string; image_url: string | null }[];
  correct_label: string | null; explanation_md: string | null;
};
export type ExportContent = { id: string; title: string; created_at: string; with_answers: boolean; config: Record<string, unknown>; questions: ExportQuestion[] };

export const AREA_LABEL: Record<string, string> = { linguagens: "Linguagens", humanas: "Ciências Humanas", natureza: "Ciências da Natureza", matematica: "Matemática" };

/** "ENEM 2023 · Q47 · Matemática — Porcentagem" */
export function questionMeta(q: ExportQuestion): string {
  const src = [q.board, q.year].filter(Boolean).join(" ") + (q.number ? ` · Q${q.number}` : "");
  const subj = [q.subject ?? (q.area ? AREA_LABEL[q.area] : null), q.topic].filter(Boolean).join(" — ");
  return [src, subj].filter(Boolean).join(" · ");
}

/** Agrupa em capítulos por disciplina (mantém a ordem da lista). */
export function chapters(qs: ExportQuestion[]): { title: string; questions: ExportQuestion[] }[] {
  const out: { title: string; questions: ExportQuestion[] }[] = [];
  for (const q of qs) {
    const title = q.subject ?? (q.area ? AREA_LABEL[q.area] : "Questões");
    const last = out.at(-1);
    if (last && last.title === title) last.questions.push(q); else out.push({ title, questions: [q] });
  }
  // lista aleatória (estilo prova) vira muitos capítulos pequenos: junta tudo
  return out.length > Math.max(6, qs.length / 3) ? [{ title: "Questões", questions: qs }] : out;
}

export const safeFilename = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "vestibularr";
