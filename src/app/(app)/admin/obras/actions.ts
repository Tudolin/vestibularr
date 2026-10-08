"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const schema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(2, "Informe o título").max(160),
  author: z.preprocess(blank, z.string().trim().max(120).optional()),
  year_from: z.preprocess(blank, z.coerce.number().int().min(1990).max(2100).optional()),
  year_to: z.preprocess(blank, z.coerce.number().int().min(1990).max(2100).optional()),
  notes: z.preprocess(blank, z.string().trim().max(500).optional()),
}).refine((d) => !d.year_from || !d.year_to || d.year_from <= d.year_to, { message: "Ano inicial maior que o final", path: ["year_to"] });

export async function saveWorkAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: "Confira os campos.", fieldErrors: p.error.flatten().fieldErrors };
  const { id, ...d } = p.data;
  const supabase = await createClient();
  const row = { board_id: undefined as string | undefined, title: d.title, author: d.author ?? null, year_from: d.year_from ?? null, year_to: d.year_to ?? null, notes: d.notes ?? null };
  if (id) {
    const { error } = await supabase.from("literary_works").update(row).eq("id", id);
    if (error) return { ok: false, error: error.code === "23505" ? "Já existe uma obra com esse título." : "Não foi possível salvar." };
  } else {
    const { data: b } = await supabase.from("exam_boards").select("id").eq("code", "UFPR").single();
    const { error } = await supabase.from("literary_works").insert({ ...row, board_id: b!.id });
    if (error) return { ok: false, error: error.code === "23505" ? "Já existe uma obra com esse título." : "Não foi possível salvar." };
  }
  revalidatePath("/admin/obras");
  revalidatePath("/estudar/obras");
  return { ok: true };
}

export async function deleteWorkAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Id inválido." };
  const { error } = await (await createClient()).from("literary_works").delete().eq("id", id);
  if (error) return { ok: false, error: "Não foi possível excluir." };
  revalidatePath("/admin/obras");
  revalidatePath("/estudar/obras");
  return { ok: true };
}
