"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

const url = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.url().refine((u) => /^https?:\/\//i.test(u), "Use um link http(s)").nullable());
const schema = z.object({ id: z.uuid(), pdf_url: url, answer_pdf_url: url, is_published: z.boolean() });

export async function updateExamAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: "Confira os links (precisam começar com http:// ou https://).", fieldErrors: p.error.flatten().fieldErrors };
  const { id, ...rest } = p.data;
  const { error } = await (await createClient()).from("exams").update(rest).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível salvar." };
  revalidatePath("/admin/provas");
  return { ok: true };
}
