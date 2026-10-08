import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const PAGE_SIZE = 20;

export const filtersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  board: z.enum(["ENEM", "UFPR"]).optional(),
  area: z.enum(["linguagens", "humanas", "natureza", "matematica"]).optional(),
  year: z.coerce.number().int().optional(),
  kind: z.enum(["objective", "discursive"]).optional(),
  work: z.uuid().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type Filters = z.infer<typeof filtersSchema>;

/** Converte searchParams (string | string[] | "") em filtros validados; valores inválidos são ignorados. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const flat = Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v !== undefined && v !== ""),
  );
  const res = filtersSchema.safeParse(flat);
  if (res.success) return res.data;
  // descarta só os campos inválidos
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) {
    if (filtersSchema.shape[k as keyof typeof filtersSchema.shape]?.safeParse(v).success) clean[k] = v;
  }
  return filtersSchema.parse(clean);
}

export type QuestionListItem = {
  id: string;
  number: number | null;
  area: string | null;
  subject: string | null;
  topic: string | null;
  year: number | null;
  language: string | null;
  kind: "objective" | "discursive";
  is_active: boolean;
  statement_md: string;
  board: { code: string } | null;
  exam: { name: string } | null;
  work: { title: string } | null;
};

export async function listQuestions(f: Filters) {
  const supabase = await createClient();
  let query = supabase
    .from("questions")
    .select(
      "id, number, area, subject, topic, year, language, kind, is_active, statement_md, board:exam_boards(code), exam:exams!questions_exam_id_fkey(name), work:literary_works(title)",
      { count: "exact" },
    );
  if (f.board) {
    const { data: b } = await supabase.from("exam_boards").select("id").eq("code", f.board).single();
    if (b) query = query.eq("board_id", b.id);
  }
  if (f.area) query = query.eq("area", f.area);
  if (f.year) query = query.eq("year", f.year);
  if (f.kind) query = query.eq("kind", f.kind);
  if (f.work) query = query.eq("work_id", f.work);
  if (f.status) query = query.eq("is_active", f.status === "active");
  if (f.q) query = query.textSearch("search", f.q, { type: "websearch", config: "portuguese" });
  const from = (f.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("year", { ascending: false, nullsFirst: false })
    .order("number", { ascending: true })
    .order("id", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { items: (data ?? []) as unknown as QuestionListItem[], total: count ?? 0 };
}

export async function filterOptions() {
  const supabase = await createClient();
  const [exams, works] = await Promise.all([
    supabase.from("exams").select("year"),
    supabase.from("literary_works").select("id, title").order("title"),
  ]);
  const years = [...new Set((exams.data ?? []).map((e) => e.year))].sort((a, b) => b - a);
  return { years, works: works.data ?? [] };
}

export async function getQuestion(id: string, withKey: boolean) {
  const supabase = await createClient();
  const { data: q } = await supabase
    .from("questions")
    .select("*, board:exam_boards(code,name), exam:exams!questions_exam_id_fkey(name, pdf_url, answer_pdf_url), work:literary_works(id, title), alternatives(id, label, text_md, image_url)")
    .eq("id", id)
    .maybeSingle();
  if (!q) return null;
  q.alternatives?.sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label));
  let key = null;
  if (withKey) {
    const { data } = await supabase.from("answer_keys").select("*").eq("question_id", id).maybeSingle();
    key = data;
  }
  return { q, key };
}
