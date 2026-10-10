"use server";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

/** Monta (ou reabre) o desafio de hoje e devolve a tentativa. */
export async function startDailyAction(): Promise<ActionResult<string>> {
  await requireUser();
  const { data, error } = await (await createClient()).rpc("daily_challenge_start");
  if (error) return { ok: false, error: error.message.includes("no_questions") ? "Ainda não há questões suficientes no banco para o desafio." : "Não foi possível montar o desafio. Tente de novo." };
  return { ok: true, data: data as string };
}
