"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const themeSchema = z.object({
  id: z.uuid().optional(),
  kind: z.enum(["enem", "ufpr"]),
  title: z.string().trim().min(3).max(300),
  prompt_md: z.string().trim().min(10).max(8000),
  support_texts_md: z.preprocess(blank, z.string().max(20000).optional()),
  task_type: z.enum(["dissertativo", "resumo", "expositivo", "argumentativo", "analise_dados", "continuidade", "genero"]),
  genre: z.preprocess(blank, z.string().trim().max(60).optional()),
  line_limit: z.coerce.number().int().min(1).max(60),
  min_lines: z.coerce.number().int().min(0).max(60).default(0),
  max_score: z.coerce.number().positive().max(1000),
  official_mirror_md: z.preprocess(blank, z.string().max(20000).optional()),
  year: z.preprocess(blank, z.coerce.number().int().min(1990).max(2100).optional()),
  is_published: z.boolean().default(true),
});

export async function saveThemeAction(input: unknown): Promise<ActionResult> {
  const me = await requireAdmin();
  const p = themeSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Confira os campos.", fieldErrors: p.error.flatten().fieldErrors };
  const { id, ...d } = p.data;
  const row = { ...d, support_texts_md: d.support_texts_md ?? null, genre: d.genre ?? null, official_mirror_md: d.official_mirror_md ?? null, year: d.year ?? null };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("essay_themes").update(row).eq("id", id)
    : await supabase.from("essay_themes").insert({ ...row, source: "admin", created_by: me.id });
  if (error) return { ok: false, error: "Não foi possível salvar." };
  revalidatePath("/admin/temas");
  revalidatePath("/redacao");
  return { ok: true };
}

export async function deleteThemeAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await (await createClient()).from("essay_themes").delete().eq("id", id);
  if (error) return { ok: false, error: error.code === "23503" ? "Há redações neste tema: despublique em vez de excluir." : "Não foi possível excluir." };
  revalidatePath("/admin/temas");
  return { ok: true };
}

export async function commentCorrectionAction(correctionId: string, text: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(correctionId).success || text.length > 4000) return { ok: false, error: "Inválido." };
  const { error } = await (await createClient())
    .from("essay_corrections")
    .update({ admin_comment: text.trim() || null, admin_comment_at: new Date().toISOString() })
    .eq("id", correctionId);
  if (error) return { ok: false, error: "Não foi possível salvar o comentário." };
  return { ok: true };
}

const criterionSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9_]{1,30}$/, "Chave: minúsculas, números e _"),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(1000),
  max: z.coerce.number().positive(),
  step: z.preprocess(blank, z.coerce.number().positive().optional()),
});
const rubricSchema = z.object({
  kind: z.enum(["enem", "ufpr", "discursive"]),
  name: z.string().trim().min(3).max(120),
  instructions: z.string().max(4000),
  criteria: z.array(criterionSchema).min(1).max(12),
});

/** Cria uma NOVA versão da rubrica e a ativa (correções antigas continuam apontando para a versão usada). */
export async function saveRubricAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const p = rubricSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Confira os critérios." };
  const d = p.data;
  if (new Set(d.criteria.map((c) => c.key)).size !== d.criteria.length) return { ok: false, error: "Chaves de critério repetidas." };
  if (d.kind !== "enem") {
    const sum = d.criteria.reduce((s, c) => s + c.max, 0);
    if (Math.abs(sum - 1) > 0.001) return { ok: false, error: `Nas rubricas UFPR/discursivas os máximos são frações e devem somar 1 (soma atual ${sum.toFixed(3)}).` };
  }
  const supabase = await createClient();
  const { data: last } = await supabase.from("rubrics").select("version").eq("kind", d.kind).order("version", { ascending: false }).limit(1).maybeSingle();
  await supabase.from("rubrics").update({ is_active: false }).eq("kind", d.kind).eq("is_active", true);
  const { error } = await supabase.from("rubrics").insert({ ...d, version: (last?.version ?? 0) + 1, is_active: true });
  if (error) return { ok: false, error: "Não foi possível salvar a rubrica." };
  revalidatePath("/admin/rubricas");
  return { ok: true };
}
