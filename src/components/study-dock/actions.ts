"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { NOTES_MAX, studyToolsSchema } from "@/lib/study-tools";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

/** Salva os ajustes do painel de estudo no perfil (valem em qualquer aparelho, na próxima sessão). */
export async function saveStudyToolsAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = studyToolsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ajustes inválidos." };
  const { error } = await (await createClient())
    .from("profiles")
    .update({ preferences: { ...user.preferences, study_tools: parsed.data } })
    .eq("id", user.id);
  return error ? { ok: false, error: "Não foi possível salvar." } : { ok: true };
}

/** Bloco de anotações rápidas do painel. */
export async function saveStudyNotesAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.string().max(NOTES_MAX).safeParse(input);
  if (!parsed.success) return { ok: false, error: `Máximo de ${NOTES_MAX} caracteres.` };
  const { error } = await (await createClient())
    .from("profiles")
    .update({ preferences: { ...user.preferences, study_notes: parsed.data } })
    .eq("id", user.id);
  return error ? { ok: false, error: "Não foi possível salvar." } : { ok: true };
}
