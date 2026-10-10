import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { readNotifyPrefs, type NotifyKind, type PushPayload } from "./notifications";

/**
 * Envio de notificações (só no servidor), por push (Web Push/VAPID; no app das lojas vira notificação nativa).
 * Sem as chaves no ambiente, o envio é ignorado em silêncio (o app funciona igual). Sem e-mail, por decisão do produto.
 */
let configured: boolean | null = null;
function vapidReady() {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  configured = !!(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contato@vestibularr.app", pub!, priv!);
  return configured;
}
export const pushConfigured = () => vapidReady();

/** Manda push para todos os aparelhos do aluno; inscrições mortas (404/410) são apagadas. Devolve quantos chegaram. */
export async function sendPush(userId: string, payload: PushPayload): Promise<number> {
  if (!vapidReady()) return 0;
  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  let ok = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 6, urgency: "normal" });
      ok++;
      await admin.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
    }
  }));
  return ok;
}

/** Notifica respeitando as preferências do aluno (o tipo de aviso está ligado?). Devolve quantos aparelhos receberam. */
export async function notifyUser(userId: string, kind: NotifyKind, payload: PushPayload): Promise<{ push: number }> {
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("preferences, is_active").eq("id", userId).maybeSingle();
  if (!p?.is_active) return { push: 0 };
  const prefs = readNotifyPrefs((p.preferences as Record<string, unknown> | null)?.notifications);
  if (kind !== "teste" && !prefs[kind]) return { push: 0 };
  return { push: await sendPush(userId, payload) };
}
