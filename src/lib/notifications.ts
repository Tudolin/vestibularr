import { z } from "zod";

/** Preferências de notificação (profiles.preferences.notifications). */
export const notifyPrefsSchema = z.object({
  push: z.boolean(),
  email: z.boolean(),
  hour: z.number().int().min(6).max(22),
  lembrete: z.boolean(),
  social: z.boolean(),
  liga: z.boolean(),
});
export type NotifyPrefs = z.infer<typeof notifyPrefsSchema>;
export const DEFAULT_NOTIFY: NotifyPrefs = { push: false, email: false, hour: 19, lembrete: true, social: true, liga: true };
export function readNotifyPrefs(raw: unknown): NotifyPrefs {
  const p = notifyPrefsSchema.safeParse({ ...DEFAULT_NOTIFY, ...(raw && typeof raw === "object" ? raw : {}) });
  return p.success ? p.data : DEFAULT_NOTIFY;
}

export type NotifyKind = "lembrete" | "social" | "liga" | "teste";
export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Lembrete do dia: tom divertido, sem culpa; muda com a sequência. */
export function reminderText(firstName: string, streak: number): PushPayload {
  const n = firstName || "pirata";
  if (streak >= 2) return { title: `🔥 ${streak} dias seguidos!`, body: `${n}, não deixa a sequência afundar: 10 minutinhos hoje já contam.`, url: "/inicio", tag: "lembrete" };
  if (streak === 1) return { title: "⚓ O convés tá te esperando", body: `${n}, estudou ontem? Bora fazer de novo hoje e começar uma sequência.`, url: "/inicio", tag: "lembrete" };
  return { title: "📚 Bora estudar um pouco?", body: `${n}, umas questões hoje e o Capitão fica orgulhoso. Leva 10 minutos.`, url: "/estudar", tag: "lembrete" };
}
