"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { UFPR_2027_SUBJECTS } from "@/lib/scoring/ufpr";
import type { ActionResult } from "@/lib/validation";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const w = z.coerce.number().min(0).max(10);
const courseSchema = z.object({
  id: z.uuid().optional(),
  institution: z.string().trim().min(2).max(40),
  via: z.enum(["ufpr", "sisu"]),
  name: z.string().trim().min(2).max(120),
  campus: z.preprocess(blank, z.string().trim().max(60).optional()),
  shift: z.preprocess(blank, z.string().trim().max(30).optional()),
  notes: z.preprocess(blank, z.string().trim().max(500).optional()),
  specific: z.array(z.enum(Object.keys(UFPR_2027_SUBJECTS) as [string, ...string[]])).max(2).default([]),
  weights: z.object({ linguagens: w, humanas: w, natureza: w, matematica: w, redacao: w }).optional(),
});

/** Peso UFPR das específicas segue o edital (6.7.3.1); o admin só escolhe as disciplinas. */
function ufprWeight(subjects: string[]) {
  const n = subjects.reduce((s, x) => s + (UFPR_2027_SUBJECTS[x] ?? 0), 0);
  return n <= 5 ? 3 : n <= 10 ? 2.5 : 2;
}

export async function saveCourseAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const p = courseSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Confira os campos." };
  const d = p.data;
  const row = {
    institution: d.institution, via: d.via, name: d.name, campus: d.campus ?? null, shift: d.shift ?? null, notes: d.notes ?? null,
    ufpr_specific: d.via === "ufpr" ? d.specific.map((subject) => ({ subject, weight: ufprWeight(d.specific) })) : [],
    sisu_weights: d.via === "sisu" ? d.weights ?? null : null,
  };
  const supabase = await createClient();
  const { error } = d.id ? await supabase.from("courses").update(row).eq("id", d.id) : await supabase.from("courses").insert(row);
  if (error) return { ok: false, error: "Não foi possível salvar o curso." };
  revalidatePath("/admin/cursos");
  return { ok: true };
}

export async function deleteCourseAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await (await createClient()).from("courses").update({ is_active: false }).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível remover." };
  revalidatePath("/admin/cursos");
  return { ok: true };
}

const cutoffSchema = z.object({
  course_id: z.uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  modality: z.string().trim().min(2).max(60),
  cutoff: z.coerce.number().min(0).max(1000),
  source: z.preprocess(blank, z.string().trim().max(200).optional()),
});

export async function saveCutoffAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const p = cutoffSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Confira ano, modalidade e nota." };
  const { error } = await (await createClient()).from("course_cutoffs").upsert({ ...p.data, source: p.data.source ?? null }, { onConflict: "course_id,year,modality" });
  if (error) return { ok: false, error: "Não foi possível salvar a nota de corte." };
  revalidatePath("/admin/cursos");
  return { ok: true };
}

export async function deleteCutoffAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  await (await createClient()).from("course_cutoffs").delete().eq("id", id);
  revalidatePath("/admin/cursos");
  return { ok: true };
}
