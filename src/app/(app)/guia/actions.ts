"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { GUIDE_PREF } from "@/lib/guide";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

/** Guarda no perfil (vale em todos os aparelhos) se o vídeo de boas-vindas deve aparecer ao entrar. */
export async function setGuideDismissedAction(dismissed: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (typeof dismissed !== "boolean") return { ok: false, error: "Valor inválido." };
  const { error } = await (await createClient())
    .from("profiles")
    .update({ preferences: { ...user.preferences, [GUIDE_PREF]: dismissed } })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Não foi possível salvar." };
  revalidatePath("/", "layout");
  return { ok: true };
}
