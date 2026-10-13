"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

const sendSchema = z.object({
  kind: z.enum(["elogio", "ideia", "melhoria", "problema"]),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  message: z.string().trim().min(3, "Escreva um pouquinho mais").max(2000, "Até 2.000 caracteres"),
  page: z.string().max(200).optional(),
});

export async function sendFeedbackAction(input: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const p = sendSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Confira os campos." };
  const ua = (await headers()).get("user-agent") ?? "";
  const device = ua.slice(0, 300);
  const supabase = await createClient();
  const { error } = await supabase.from("feedback").insert({
    user_id: me.id, kind: p.data.kind, rating: p.data.rating ?? null, message: p.data.message, page: p.data.page || null, device,
  });
  if (error) {
    return { ok: false, error: /feedback_limit/.test(error.message) ? "Você já mandou muitos feedbacks hoje. Valeu demais! Tente amanhã." : "Não foi possível enviar agora. Tente de novo." };
  }
  revalidatePath("/feedback");
  revalidatePath("/admin/feedbacks");
  return { ok: true };
}

const updateSchema = z.object({
  id: z.uuid(),
  status: z.enum(["novo", "lido", "resolvido"]).optional(),
  reply: z.string().trim().max(2000).nullable().optional(),
});

/** Admin: muda o status e/ou responde (o aluno vê a resposta em Feedback). */
export async function updateFeedbackAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const p = updateSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Confira os campos." };
  const patch: Record<string, unknown> = {};
  if (p.data.status) patch.status = p.data.status;
  if (p.data.reply !== undefined) patch.reply = p.data.reply || null;
  const supabase = await createClient();
  const { error } = await supabase.from("feedback").update(patch).eq("id", p.data.id);
  if (error) return { ok: false, error: "Não foi possível salvar." };
  revalidatePath("/admin/feedbacks");
  return { ok: true };
}
