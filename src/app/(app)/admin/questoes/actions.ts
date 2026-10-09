"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { AREAS, LABELS } from "@/lib/import/schema";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const editSchema = z.object({
  id: z.uuid(),
  area: z.preprocess(blank, z.enum(AREAS).optional()),
  subject: z.preprocess(blank, z.string().trim().max(120).optional()),
  topic: z.preprocess(blank, z.string().trim().max(200).optional()),
  work_id: z.preprocess(blank, z.uuid().optional()),
  is_active: z.boolean(),
  statement_md: z.string().trim().min(1, "Enunciado vazio").max(60000),
  alternatives: z.array(z.object({ label: z.enum(LABELS), text_md: z.string().max(5000) })).max(5),
  correct: z.preprocess(blank, z.enum(LABELS).optional()),
  explanation_md: z.preprocess(blank, z.string().max(20000).optional()),
  official_mirror_md: z.preprocess(blank, z.string().max(20000).optional()),
});

/** Usa o JWT do admin: a RLS é quem autoriza, não a service-role. */
export async function updateQuestionAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const p = editSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Confira os campos.", fieldErrors: p.error.flatten().fieldErrors };
  const d = p.data;
  const labels = d.alternatives.map((a) => a.label);
  if (new Set(labels).size !== labels.length) return { ok: false, error: "Letras de alternativa repetidas." };
  if (d.correct && labels.length > 0 && !labels.includes(d.correct)) return { ok: false, error: `Gabarito ${d.correct} não existe nas alternativas.` };

  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .update({
      area: d.area ?? null,
      subject: d.subject ?? null,
      topic: d.topic ?? null,
      work_id: d.work_id ?? null,
      is_active: d.is_active,
      statement_md: d.statement_md,
    })
    .eq("id", d.id);
  if (error) return { ok: false, error: "Não foi possível salvar a questão." };

  if (d.alternatives.length > 0) {
    await supabase.from("alternatives").delete().eq("question_id", d.id).not("label", "in", `(${labels.join(",")})`);
    const { error: e2 } = await supabase
      .from("alternatives")
      .upsert(d.alternatives.map((a) => ({ question_id: d.id, label: a.label, text_md: a.text_md })), { onConflict: "question_id,label" });
    if (e2) return { ok: false, error: "Não foi possível salvar as alternativas." };
  }
  const { error: e3 } = await supabase.from("answer_keys").upsert(
    { question_id: d.id, correct_label: d.correct ?? null, explanation_md: d.explanation_md ?? null, official_mirror_md: d.official_mirror_md ?? null },
    { onConflict: "question_id" },
  );
  if (e3) return { ok: false, error: "Não foi possível salvar o gabarito." };

  revalidatePath("/admin/questoes");
  revalidatePath(`/estudar/questoes/${d.id}`);
  return { ok: true };
}

export async function deleteQuestionAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Id inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) return { ok: false, error: "Não foi possível excluir." };
  revalidatePath("/admin/questoes");
  return { ok: true };
}

/** Liga/desliga "alunos só veem questões com resolução" (configuração only_solved_questions). */
export async function setOnlySolvedAction(on: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (typeof on !== "boolean") return { ok: false, error: "Valor inválido." };
  const { error } = await (await createClient()).from("settings").update({ value: on }).eq("key", "only_solved_questions");
  if (error) return { ok: false, error: "Não foi possível salvar." };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
