import { z } from "zod";

/** Preferências de notificação (profiles.preferences.notifications). */
export const notifyPrefsSchema = z.object({
  push: z.boolean(),
  hour: z.number().int().min(6).max(22),
  lembrete: z.boolean(),
  social: z.boolean(),
  liga: z.boolean(),
});
export type NotifyPrefs = z.infer<typeof notifyPrefsSchema>;
export const DEFAULT_NOTIFY: NotifyPrefs = { push: false, hour: 19, lembrete: true, social: true, liga: true };
export function readNotifyPrefs(raw: unknown): NotifyPrefs {
  const p = notifyPrefsSchema.safeParse({ ...DEFAULT_NOTIFY, ...(raw && typeof raw === "object" ? raw : {}) });
  return p.success ? p.data : DEFAULT_NOTIFY;
}

export type NotifyKind = "lembrete" | "social" | "liga" | "teste";
export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Lembrete do dia: tom divertido, sem culpa; muda com a sequência. */
export function reminderText(firstName: string, streak: number, shields = 0): PushPayload {
  const n = firstName || "pirata";
  if (streak >= 2) return { title: `🔥 ${streak} dias seguidos!`, body: `${n}, o desafio do dia leva 10 minutos e mantém a sequência${shields ? ` (você tem ${shields} escudo${shields > 1 ? "s" : ""} 🛡️, mas melhor não gastar)` : ""}.`, url: "/inicio", tag: "lembrete" };
  if (streak === 1) return { title: "⚓ O convés tá te esperando", body: `${n}, faz o desafio do dia de hoje e começa uma sequência. São só 7 questões.`, url: "/inicio", tag: "lembrete" };
  return { title: "⚔️ Desafio do dia liberado", body: `${n}, 7 questões escolhidas para você, com um chefão no final. Leva 10 minutos.`, url: "/inicio", tag: "lembrete" };
}
