import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { readNotifyPrefs, type NotifyKind, type PushPayload } from "./notifications";

/**
 * Envio de notificações (só no servidor). Push via Web Push/VAPID e e-mail via Resend — os dois são opcionais:
 * sem as chaves no ambiente, o envio é ignorado em silêncio (o app funciona igual).
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
export const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

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

export async function sendEmail(to: string, subject: string, text: string, url: string): Promise<boolean> {
  if (!emailConfigured()) return false;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;max-width:480px">
    <p>${text.replace(/</g, "&lt;")}</p>
    <p><a href="${site}${url}" style="display:inline-block;background:#2f3cff;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700">Abrir o Vestibularr</a></p>
    <p style="color:#666;font-size:13px">Você recebe este e-mail porque ativou os lembretes. Para parar, desligue em Perfil → Notificações.</p></div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, html, text: `${text}\n\n${site}${url}` }),
  }).catch(() => null);
  return !!r?.ok;
}

/** Notifica respeitando as preferências do aluno (tipo ligado? push ligado?). E-mail só para lembrete e liga. */
export async function notifyUser(userId: string, kind: NotifyKind, payload: PushPayload): Promise<{ push: number; email: boolean }> {
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("email, preferences, is_active").eq("id", userId).maybeSingle();
  if (!p?.is_active) return { push: 0, email: false };
  const prefs = readNotifyPrefs((p.preferences as Record<string, unknown> | null)?.notifications);
  if (kind !== "teste" && !prefs[kind]) return { push: 0, email: false };
  const push = await sendPush(userId, payload);
  const email = (kind === "lembrete" || kind === "liga" || kind === "teste") && prefs.email && !!p.email
    ? await sendEmail(p.email, payload.title.replace(/^[^\p{L}\p{N}]+/u, ""), payload.body, payload.url) : false;
  return { push, email };
}
