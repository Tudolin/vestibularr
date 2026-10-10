"use server";

import { requireUser } from "@/lib/auth";
import { demographicsSchema } from "@/lib/demographics";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

/** Grava (ou apaga, se tudo vier vazio) as respostas opcionais de "Sobre você". */
export async function saveDemographicsAction(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const p = demographicsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Confira as respostas." };
  const d = { ...p.data, city: p.data.city?.trim() || null };
  const supabase = await createClient();
  const empty = Object.values(d).every((v) => v == null || v === "");
  const { error } = empty
    ? await supabase.from("profile_demographics").delete().eq("user_id", me.id)
    : await supabase.from("profile_demographics").upsert({ user_id: me.id, ...d, updated_at: new Date().toISOString() });
  return error ? { ok: false, error: "Não foi possível salvar." } : { ok: true };
}
