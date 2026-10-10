"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { notifyPrefsSchema } from "@/lib/notifications";
import { notifyUser, pushConfigured } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

const subSchema = z.object({ endpoint: z.url().startsWith("https://").max(1000), keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }) });

export async function savePushSubscriptionAction(sub: unknown, ua: string): Promise<ActionResult> {
  await requireUser();
  const p = subSchema.safeParse(sub);
  if (!p.success) return { ok: false, error: "Inscrição inválida." };
  const { error } = await (await createClient()).rpc("push_subscribe", { p_endpoint: p.data.endpoint, p_p256dh: p.data.keys.p256dh, p_auth: p.data.keys.auth, p_ua: String(ua).slice(0, 300) });
  return error ? { ok: false, error: "Não foi possível ativar agora." } : { ok: true };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionResult> {
  await requireUser();
  await (await createClient()).from("push_subscriptions").delete().eq("endpoint", String(endpoint).slice(0, 1000));
  return { ok: true };
}

export async function saveNotifyPrefsAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const p = notifyPrefsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Preferências inválidas." };
  const { error } = await (await createClient()).from("profiles").update({ preferences: { ...user.preferences, notifications: p.data } }).eq("id", user.id);
  return error ? { ok: false, error: "Não foi possível salvar." } : { ok: true };
}

export async function testNotificationAction(): Promise<ActionResult<{ push: number }>> {
  const user = await requireUser();
  if (!pushConfigured()) return { ok: false, error: "As notificações ainda não foram configuradas no servidor (chaves VAPID)." };
  const r = await notifyUser(user.id, "teste", { title: "🔔 Teste do Vestibularr", body: "Se você está vendo isto, os avisos estão funcionando!", url: "/perfil", tag: "teste" });
  if (!r.push) return { ok: false, error: "Nenhum aparelho recebeu. Ative as notificações neste aparelho primeiro." };
  return { ok: true, data: r };
}
