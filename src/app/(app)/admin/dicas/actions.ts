"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

const schema = z.object({
  id: z.uuid().optional(),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,60}$/, "Endereço: só letras minúsculas, números e hífen"),
  title: z.string().trim().min(3).max(120),
  summary: z.string().trim().max(240).default(""),
  category: z.string().trim().min(2).max(40),
  body_md: z.string().max(50000),
  sort: z.coerce.number().int().min(0).max(9999).default(100),
  is_published: z.boolean(),
});

export async function saveTipAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Confira os campos." };
  const { id, ...d } = p.data;
  const supabase = await createClient();
  const { error } = id ? await supabase.from("tips").update(d).eq("id", id) : await supabase.from("tips").insert(d);
  if (error) return { ok: false, error: error.code === "23505" ? "Já existe uma dica com esse endereço." : "Não foi possível salvar." };
  revalidatePath("/dicas");
  revalidatePath(`/dicas/${d.slug}`);
  revalidatePath("/admin/dicas");
  return { ok: true };
}

export async function deleteTipAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  await (await createClient()).from("tips").delete().eq("id", id);
  revalidatePath("/dicas");
  revalidatePath("/admin/dicas");
  return { ok: true };
}
