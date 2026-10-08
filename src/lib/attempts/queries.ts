import "server-only";
import { createClient } from "@/lib/supabase/server";

export type OpenAttempt = { id: string; title: string; mode: string; status: string; deadline_at: string | null; started_at: string; exam_id: string | null; total: number; answered: number };

/** Tentativas em andamento/pausadas do usuário (RLS garante que só vê as suas). */
export async function listOpenAttempts(limit = 10): Promise<OpenAttempt[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exam_attempts")
    .select("id, title, mode, status, deadline_at, started_at, exam_id, attempt_questions(count), attempt_answers(count)")
    .in("status", ["in_progress", "paused"])
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((a) => ({
    id: a.id, title: a.title, mode: a.mode, status: a.status, deadline_at: a.deadline_at, started_at: a.started_at, exam_id: a.exam_id,
    total: (a.attempt_questions as unknown as { count: number }[])?.[0]?.count ?? 0,
    answered: (a.attempt_answers as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));
}

export async function dueErrorsCount(): Promise<{ due: number; total: number }> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [due, total] = await Promise.all([
    supabase.from("error_notebook").select("question_id", { count: "exact", head: true }).is("resolved_at", null).lte("next_review_at", nowIso),
    supabase.from("error_notebook").select("question_id", { count: "exact", head: true }).is("resolved_at", null),
  ]);
  return { due: due.count ?? 0, total: total.count ?? 0 };
}

export type Facets = {
  subjects: { name: string; board: string; n: number }[];
  topics: { name: string; subject: string | null; board: string; n: number }[];
  areas: { name: string; board: string; n: number }[];
  works: { id: string; title: string }[];
};
export async function bankFacets(): Promise<Facets> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("bank_facets");
  return (data ?? { subjects: [], topics: [], areas: [], works: [] }) as Facets;
}
