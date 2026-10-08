import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { AiError, generateJson } from "./gemini";
import { discursivePrompt, enemPrompt, ufprPrompt, type RubricCriterion, type Theme } from "./prompts";
import {
  checkDiscursiveIds, checkUfprAgainstRubric, discursiveBatchSchema, enemCorrectionSchema, keepRealQuotes, ufprCorrectionSchema,
} from "./schemas";

type Job = { id: string; user_id: string; kind: "essay" | "discursive" | "transcribe"; status: string; ref: Record<string, unknown>; attempts: number };
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Executa um trabalho de IA. Chamado via after() (depois da resposta ao aluno), com service-role:
 * o trabalho já foi reservado e validado pelas RPCs com o JWT do aluno.
 * "Reivindica" o trabalho com update condicional para não rodar duas vezes.
 */
export async function runAiJob(jobId: string): Promise<void> {
  const db = createAdminClient();
  const { data: job } = await db.from("ai_jobs").select("*").eq("id", jobId).maybeSingle<Job>();
  if (!job || job.status !== "queued") return;
  const { data: claimed } = await db
    .from("ai_jobs")
    .update({ status: "running", started_at: new Date().toISOString(), attempts: job.attempts + 1, error: null })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  try {
    let model: string | undefined;
    if (job.kind === "essay") model = await runEssay(db, job);
    else if (job.kind === "discursive") model = await runDiscursive(db, job);
    else throw new AiError("Tipo de trabalho não executável em segundo plano.");
    await db.from("ai_jobs").update({ status: "done", finished_at: new Date().toISOString(), model }).eq("id", jobId);
  } catch (e) {
    const msg = e instanceof AiError ? e.message : "Erro inesperado na correção.";
    console.error("[ai] trabalho falhou", jobId, e);
    await db.from("ai_jobs").update({ status: "failed", finished_at: new Date().toISOString(), error: msg }).eq("id", jobId);
    if (job.kind === "essay" && job.ref.correction_id) {
      await db.from("essay_corrections").update({ status: "failed", error: msg }).eq("id", job.ref.correction_id as string);
    }
  }
}

async function runEssay(db: SupabaseClient, job: Job): Promise<string> {
  const { data: corr } = await db
    .from("essay_corrections")
    .select("id, rubric:rubrics(criteria, instructions), version:essay_versions(content), essay:essays(kind, theme:essay_themes(*))")
    .eq("id", job.ref.correction_id as string)
    .single();
  if (!corr) throw new AiError("Correção não encontrada.");
  const text = (corr.version as unknown as { content: string }).content;
  const essay = corr.essay as unknown as { kind: "enem" | "ufpr"; theme: Theme };
  const rubric = corr.rubric as unknown as { criteria: RubricCriterion[]; instructions: string };
  await db.from("essay_corrections").update({ status: "running" }).eq("id", corr.id);

  if (essay.kind === "enem") {
    const p = enemPrompt(essay.theme, rubric, text);
    const { value, model } = await generateJson({ system: p.system, parts: [{ text: p.user }], schema: enemCorrectionSchema });
    const comp = value.competencies.map((c) => ({ ...c, score: value.annulled.value ? 0 : c.score }));
    const scores = Object.fromEntries(comp.map((c) => [c.key, c.score]));
    const total = comp.reduce((s, c) => s + c.score, 0);
    await db.from("essay_corrections").update({
      status: "done", scores, total, max_total: 1000, model, finished_at: new Date().toISOString(),
      feedback: {
        annulled: value.annulled,
        criteria: comp.map((c) => ({ key: c.key, name: rubric.criteria.find((r) => r.key === c.key)?.name ?? c.key, score: c.score, max: 200, justification: c.justification })),
        highlights: keepRealQuotes(value.highlights, text),
        suggestions: value.suggestions,
        intervention: value.intervention,
        summary: value.summary,
      },
    }).eq("id", corr.id);
    return model;
  }

  const p = ufprPrompt(essay.theme, rubric, text);
  const maxScore = Number(essay.theme.max_score);
  const { value, model } = await generateJson({
    system: p.system,
    parts: [{ text: p.user }],
    schema: ufprCorrectionSchema,
    extraCheck: (v) => checkUfprAgainstRubric(v, rubric.criteria, maxScore),
  });
  const crit = value.criteria.map((c) => ({ ...c, score: value.annulled.value ? 0 : round3(c.score) }));
  const total = round3(crit.reduce((s, c) => s + c.score, 0));
  await db.from("essay_corrections").update({
    status: "done", scores: Object.fromEntries(crit.map((c) => [c.key, c.score])), total, max_total: maxScore, model, finished_at: new Date().toISOString(),
    feedback: {
      annulled: value.annulled,
      criteria: crit.map((c) => {
        const r = rubric.criteria.find((x) => x.key === c.key)!;
        return { key: c.key, name: r.name, score: c.score, max: round3(r.max * maxScore), justification: c.justification };
      }),
      highlights: keepRealQuotes(value.highlights, text),
      suggestions: value.suggestions,
      mirror_comparison: value.mirror_comparison ?? null,
      summary: value.summary,
    },
  }).eq("id", corr.id);
  return model;
}

async function runDiscursive(db: SupabaseClient, job: Job): Promise<string> {
  const attemptId = job.ref.attempt_id as string;
  const only = (job.ref.questions as string[] | null) ?? null;
  const { data: rows } = await db
    .from("attempt_answers")
    .select("question_id, discursive_text, question:questions!inner(kind, statement_md, answer_keys(official_mirror_md, max_score))")
    .eq("attempt_id", attemptId)
    .eq("question.kind", "discursive");
  const list = (rows ?? [])
    .filter((r) => (r.discursive_text ?? "").trim() && (!only || only.includes(r.question_id)))
    .map((r, i) => {
      const q = r.question as unknown as { statement_md: string; answer_keys: { official_mirror_md: string | null; max_score: number | null } | null };
      return { id: String(i + 1), qid: r.question_id, statement: q.statement_md, mirror: q.answer_keys?.official_mirror_md ?? null, max: Number(q.answer_keys?.max_score ?? 10), answer: r.discursive_text as string };
    });
  if (!list.length) throw new AiError("Não há respostas discursivas para corrigir.");
  const { data: rub } = await db.from("rubrics").select("instructions").eq("kind", "discursive").eq("is_active", true).maybeSingle();
  const p = discursivePrompt(list, rub?.instructions ?? "");
  const maxById = Object.fromEntries(list.map((i) => [i.id, i.max]));
  const { value, model } = await generateJson({
    system: p.system,
    parts: [{ text: p.user }],
    schema: discursiveBatchSchema,
    extraCheck: (v) => checkDiscursiveIds(v, list.map((i) => i.id), maxById),
  });
  for (const item of value.items) {
    const src = list.find((i) => i.id === item.id)!;
    await db.from("discursive_feedback").upsert(
      { attempt_id: attemptId, question_id: src.qid, job_id: job.id, score: round3(item.score), max_score: src.max, feedback: { found: item.found, missing: item.missing, feedback: item.feedback, model } },
      { onConflict: "attempt_id,question_id" },
    );
  }
  return model;
}

/** Recoloca na fila um trabalho que falhou ou travou (>3 min rodando). Checa cota antes. */
export async function requeueJob(jobId: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const db = createAdminClient();
  const { data: job } = await db.from("ai_jobs").select("*").eq("id", jobId).eq("user_id", userId).maybeSingle<Job & { started_at: string | null }>();
  if (!job) return { ok: false, error: "Trabalho não encontrado." };
  const stuck = job.status === "running" && job.started_at && Date.now() - new Date(job.started_at).getTime() > 3 * 60_000;
  if (job.status !== "failed" && !stuck) return { ok: false, error: "Este trabalho ainda está em andamento." };
  if (job.attempts >= 4) return { ok: false, error: "Muitas tentativas. Fale com o administrador." };
  await db.from("ai_jobs").update({ status: "queued", error: null }).eq("id", jobId);
  if (job.kind === "essay" && job.ref.correction_id) await db.from("essay_corrections").update({ status: "queued", error: null }).eq("id", job.ref.correction_id as string);
  return { ok: true };
}
