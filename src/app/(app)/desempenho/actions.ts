"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

const goalsSchema = z.object({
  questions_day: z.coerce.number().int().min(1).max(500),
  questions_week: z.coerce.number().int().min(1).max(5000),
  minutes_week: z.coerce.number().int().min(10).max(5000),
  essays_week: z.coerce.number().int().min(1).max(20),
});

export async function saveGoalsAction(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const p = goalsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Confira os valores das metas." };
  const rows = Object.entries(p.data).map(([kind, target]) => ({ user_id: me.id, kind, target, updated_at: new Date().toISOString() }));
  const { error } = await (await createClient()).from("student_goals").upsert(rows, { onConflict: "user_id,kind" });
  if (error) return { ok: false, error: "Não foi possível salvar as metas." };
  revalidatePath("/desempenho");
  revalidatePath("/inicio");
  return { ok: true };
}

export async function setTargetCoursesAction(ids: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const p = z.array(z.uuid()).max(6).safeParse(ids);
  if (!p.success) return { ok: false, error: "Escolha até 6 cursos." };
  const { error } = await (await createClient()).from("profiles").update({ target_courses: p.data }).eq("id", me.id);
  if (error) return { ok: false, error: "Não foi possível salvar." };
  revalidatePath("/desempenho");
  return { ok: true };
}
