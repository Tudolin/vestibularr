"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

const schema = z.object({
  boards: z.array(z.enum(["ENEM", "UFPR"])).min(1, "Escolha ao menos um vestibular"),
  courses: z.array(z.uuid()).max(6),
  questionsDay: z.coerce.number().int().min(5).max(200),
});

/** Salva as escolhas do onboarding e marca o perfil como pronto. */
export async function finishOnboardingAction(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Confira suas escolhas." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ target_boards: p.data.boards, target_courses: p.data.courses, preferences: { ...me.preferences, onboarded: true } })
    .eq("id", me.id);
  if (error) return { ok: false, error: "Não foi possível salvar. Tente de novo." };
  await supabase.from("student_goals").upsert(
    [{ user_id: me.id, kind: "questions_day", target: p.data.questionsDay, updated_at: new Date().toISOString() }],
    { onConflict: "user_id,kind" },
  );
  redirect("/inicio");
}
