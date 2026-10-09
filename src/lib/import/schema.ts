import { z } from "zod";
import { isLocalImage } from "../local-image";

export const AREAS = ["linguagens", "humanas", "natureza", "matematica"] as const;
export const LABELS = ["A", "B", "C", "D", "E"] as const;
export const BOARDS = ["ENEM", "UFPR"] as const;

const optText = z.string().trim().max(400).nullish().transform((v) => (v ? v : undefined));
/** Imagem: link http(s) ou figura hospedada no próprio app (public/questoes/…). */
const httpsUrl = z.union([
  z.string().refine(isLocalImage, "Caminho inválido"),
  z.url().refine((u) => /^https?:\/\//i.test(u), "URL precisa ser http(s)"),
]);

export const alternativeSchema = z.object({
  label: z.enum(LABELS),
  text_md: z.string().max(5000).default(""),
  image_url: httpsUrl.nullish().transform((v) => v ?? undefined),
});

export const questionSchema = z
  .object({
    external_id: optText,
    number: z.coerce.number().int().positive().optional(),
    year: z.coerce.number().int().min(1990).max(2100).optional(),
    kind: z.enum(["objective", "discursive"]).default("objective"),
    area: z.enum(AREAS).nullish().transform((v) => v ?? undefined),
    subject: optText,
    topic: optText,
    work: optText,
    language: z.enum(["ingles", "espanhol"]).nullish().transform((v) => v ?? undefined),
    section: optText,
    statement_md: z.string().trim().min(1, "Enunciado vazio").max(60000),
    images: z.array(httpsUrl).max(20).default([]),
    alternatives: z.array(alternativeSchema).max(5).default([]),
    correct: z.enum(LABELS).nullish().transform((v) => v ?? undefined),
    explanation_md: z.string().max(20000).nullish().transform((v) => v || undefined),
    official_mirror_md: z.string().max(20000).nullish().transform((v) => v || undefined),
    max_score: z.coerce.number().positive().max(1000).optional(),
    source_ref: optText,
  })
  .superRefine((q, ctx) => {
    if (q.kind === "objective") {
      if (q.alternatives.length < 2) ctx.addIssue({ code: "custom", message: "Objetiva precisa de ao menos 2 alternativas", path: ["alternatives"] });
      const labels = q.alternatives.map((a) => a.label);
      if (new Set(labels).size !== labels.length) ctx.addIssue({ code: "custom", message: "Alternativas com letra repetida", path: ["alternatives"] });
      if (!q.correct) ctx.addIssue({ code: "custom", message: "Falta o gabarito (correct)", path: ["correct"] });
      else if (!labels.includes(q.correct)) ctx.addIssue({ code: "custom", message: `Gabarito ${q.correct} não existe nas alternativas`, path: ["correct"] });
    } else if (q.alternatives.length > 0) {
      ctx.addIssue({ code: "custom", message: "Discursiva não tem alternativas", path: ["alternatives"] });
    }
  });

export const examSchema = z.object({
  name: z.string().trim().min(2).max(120),
  year: z.coerce.number().int().min(1990).max(2100),
  day: optText,
  format: optText,
  pdf_url: httpsUrl.nullish().transform((v) => v ?? undefined),
  answer_pdf_url: httpsUrl.nullish().transform((v) => v ?? undefined),
});

export type Question = z.infer<typeof questionSchema>;
export type ExamMeta = z.infer<typeof examSchema>;
export type ExamBundle = ExamMeta & { questions: Question[] };
export type Bundle = { version: 1; board: (typeof BOARDS)[number]; exams: ExamBundle[]; questions: Question[] };

export type ValidationIssue = { where: string; message: string };
export type ValidationResult = {
  bundle: Bundle | null;
  issues: ValidationIssue[];
  summary: { exams: number; questions: number; invalid: number; withoutKey: number };
};

const fmtIssues = (err: z.ZodError) => err.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; ");

/**
 * Validação tolerante: itens inválidos viram `issues` (mostrados na prévia) e ficam de fora;
 * os válidos seguem. Quem chama decide se bloqueia a importação quando há problemas.
 */
export function validateBundle(raw: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const empty = { exams: 0, questions: 0, invalid: 0, withoutKey: 0 };
  if (typeof raw !== "object" || raw === null) {
    return { bundle: null, issues: [{ where: "arquivo", message: "Conteúdo não é um objeto JSON" }], summary: empty };
  }
  const r = raw as Record<string, unknown>;
  const board = BOARDS.find((b) => b === r.board);
  if (!board) return { bundle: null, issues: [{ where: "board", message: `board deve ser ${BOARDS.join(" ou ")}` }], summary: empty };
  if (r.version !== 1) issues.push({ where: "version", message: "version deve ser 1 (continuando mesmo assim)" });

  const seen = new Set<string>();
  const parseQuestions = (list: unknown, ctx: string): Question[] => {
    if (list == null) return [];
    if (!Array.isArray(list)) {
      issues.push({ where: ctx, message: "questions deve ser uma lista" });
      return [];
    }
    const out: Question[] = [];
    list.forEach((item, i) => {
      const res = questionSchema.safeParse(item);
      const where = `${ctx} › questão ${(item as { number?: number })?.number ?? i + 1}`;
      if (!res.success) return void issues.push({ where, message: fmtIssues(res.error) });
      const key = `${ctx}|${res.data.number ?? ""}|${res.data.language ?? ""}|${res.data.external_id ?? ""}`;
      if ((res.data.number != null || res.data.external_id) && seen.has(key)) {
        return void issues.push({ where, message: "Questão duplicada no arquivo (mesmo número/idioma)" });
      }
      seen.add(key);
      out.push(res.data);
    });
    return out;
  };

  const exams: ExamBundle[] = [];
  if (r.exams != null && !Array.isArray(r.exams)) issues.push({ where: "exams", message: "exams deve ser uma lista" });
  (Array.isArray(r.exams) ? r.exams : []).forEach((e, i) => {
    const meta = examSchema.safeParse(e);
    if (!meta.success) return void issues.push({ where: `prova ${i + 1}`, message: fmtIssues(meta.error) });
    exams.push({ ...meta.data, questions: parseQuestions((e as { questions?: unknown }).questions, `${meta.data.name} (${meta.data.year})`) });
  });
  const standalone = parseQuestions(r.questions, "avulsas");

  const all = [...exams.flatMap((e) => e.questions), ...standalone];
  const total = (Array.isArray(r.exams) ? (r.exams as { questions?: unknown[] }[]).reduce((n, e) => n + (Array.isArray(e?.questions) ? e.questions.length : 0), 0) : 0) + (Array.isArray(r.questions) ? r.questions.length : 0);
  const summary = {
    exams: exams.length,
    questions: all.length,
    invalid: Math.max(total - all.length, 0),
    withoutKey: all.filter((q) => q.kind === "objective" && !q.correct).length,
  };
  if (all.length === 0 && exams.length === 0) issues.push({ where: "arquivo", message: "Nenhuma questão ou prova válida encontrada" });
  return { bundle: { version: 1, board, exams, questions: standalone }, issues, summary };
}
