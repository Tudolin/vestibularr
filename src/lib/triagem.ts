import "server-only";
import { bankFacets } from "@/lib/attempts/queries";
import { computeMastery, rankTopics, type Fact } from "@/lib/mastery";
import { createClient } from "@/lib/supabase/server";
import type { Area } from "@/lib/scoring/enem";

export type TriagemState = { id: string; status: string; answered: number; total: number; question_id: string | null; position: number | null; area: string | null };
export type Entitlement = { quota: number | null; used: number; remaining: number | null; unlimited: boolean; resets_at: string | null };

/** Níveis da triagem (nota TRI média). */
export const LEVELS = [
  { min: 650, name: "Capitão", desc: "Você domina a maior parte da prova: agora é lapidar os detalhes." },
  { min: 500, name: "Navegante", desc: "Base sólida. Focando nos pontos certos, dá para subir bastante." },
  { min: -Infinity, name: "Grumete", desc: "Começo de viagem: cada assunto estudado agora vira ponto na prova." },
] as const;
export const levelOf = (score: number) => LEVELS.find((l) => score >= l.min)!;

export async function getEntitlement(feature: string): Promise<Entitlement | null> {
  const { data } = await (await createClient()).rpc("entitlement", { p_feature: feature });
  return (data as Entitlement) ?? null;
}

export async function listTriagens() {
  const { data } = await (await createClient())
    .from("exam_attempts")
    .select("id, status, started_at, finished_at, score")
    .eq("mode", "triagem")
    .order("started_at", { ascending: false })
    .limit(12);
  return (data ?? []) as { id: string; status: string; started_at: string; finished_at: string | null; score: { total: number; correct: number } | null }[];
}

type QRow = {
  position: number;
  question: { id: string; area: string | null; subject: string | null; topic: string | null; irt_a: number | null; irt_b: number | null; irt_c: number | null };
};

/** Relatório de uma triagem encerrada: nota TRI por área (com faixa), nível, pontos fortes e onde focar. */
export async function triagemReport(id: string) {
  const supabase = await createClient();
  const [{ data: attempt }, { data: qrows }, { data: answers }] = await Promise.all([
    supabase.from("exam_attempts").select("id, status, started_at, finished_at, score").eq("id", id).eq("mode", "triagem").maybeSingle(),
    supabase.from("attempt_questions").select("position, question:questions(id, area, subject, topic, irt_a, irt_b, irt_c)").eq("attempt_id", id).order("position"),
    supabase.from("attempt_answers").select("question_id, choice, time_spent_ms").eq("attempt_id", id),
  ]);
  if (!attempt) return null;
  const list = (qrows ?? []) as unknown as QRow[];
  const ids = list.map((r) => r.question.id);
  // gabarito só fica legível depois do fim (policy answer_keys_student)
  const { data: keys } = ids.length ? await supabase.from("answer_keys").select("question_id, correct_label").in("question_id", ids) : { data: [] };
  const key = new Map((keys ?? []).map((k) => [k.question_id, k.correct_label as string | null]));
  const ans = new Map((answers ?? []).map((a) => [a.question_id, a]));

  // "não sei" (em branco) conta como erro, como na prova
  const facts: Fact[] = list.map(({ question: q }) => ({
    board: "ENEM", area: q.area, subject: q.subject, topic: q.topic, irt_a: q.irt_a, irt_b: q.irt_b, irt_c: q.irt_c,
    ok: !!ans.get(q.id)?.choice && ans.get(q.id)?.choice === key.get(q.id),
  }));
  const mastery = computeMastery(facts);
  const facets = await bankFacets();
  const weights = facets.topics.filter((t) => t.board === "ENEM" && t.subject).map((t) => ({ subject: t.subject as string, topic: t.name, n: t.n }));
  const ranked = rankTopics(mastery.topics, weights, { minAnswers: 1, limit: 5 });
  const areas = mastery.areas.map((a) => ({ ...a, low: Math.round(a.score - 100 * a.se), high: Math.round(a.score + 100 * a.se) }));
  const average = areas.length ? Math.round(areas.reduce((s, a) => s + a.score, 0) / areas.length) : null;
  return {
    attempt: attempt as { id: string; status: string; started_at: string; finished_at: string | null; score: { total: number; correct: number; blank: number } | null },
    areas: areas as (typeof areas[number] & { area: Area })[],
    average,
    topics: mastery.topics,
    strengths: ranked.strengths,
    focus: ranked.focus,
  };
}
