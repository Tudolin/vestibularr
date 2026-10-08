"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { chunkBundle } from "@/lib/import/chunk";
import { validateBundle } from "@/lib/import/schema";
import { createClient } from "@/lib/supabase/server";

export type ChunkResult = { ok: true; inserted: number; updated: number } | { ok: false; error: string };

/** Revalida no servidor (o cliente não é confiável) e grava via RPC atômica, com o JWT do admin (RLS). */
export async function importChunkAction(raw: unknown): Promise<ChunkResult> {
  await requireAdmin();
  const res = validateBundle(raw);
  if (!res.bundle || res.summary.invalid > 0) {
    return { ok: false, error: res.issues[0]?.message ?? "Pedaço inválido" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_bundle", { p: res.bundle });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/questoes");
  revalidatePath("/admin/provas");
  return { ok: true, inserted: data.inserted, updated: data.updated };
}

export async function approveImportAction(id: string): Promise<ChunkResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: row } = await supabase.from("question_imports").select("payload, status").eq("id", id).single();
  if (!row || row.status !== "pending") return { ok: false, error: "Envio não encontrado ou já revisado." };
  const res = validateBundle(row.payload);
  if (!res.bundle) return { ok: false, error: "Conteúdo do envio é inválido." };
  let inserted = 0;
  let updated = 0;
  for (const part of chunkBundle(res.bundle, 100)) {
    const { data, error } = await supabase.rpc("import_bundle", { p: part });
    if (error) return { ok: false, error: error.message };
    inserted += data.inserted;
    updated += data.updated;
  }
  await supabase.from("question_imports").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/importar");
  revalidatePath("/admin/questoes");
  return { ok: true, inserted, updated };
}

export async function rejectImportAction(id: string, note: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("question_imports")
    .update({ status: "rejected", review_note: note.slice(0, 500) || null, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { ok: false, error: "Não foi possível rejeitar." };
  revalidatePath("/admin/importar");
  return { ok: true };
}
