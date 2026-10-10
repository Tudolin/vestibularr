"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { AVATAR_COLORS, AVATAR_EMOJIS, NUDGES, REACTIONS, socialError, type SearchCard } from "@/lib/social";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

const uuid = z.uuid();

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  await requireUser();
  const { data, error } = await (await createClient()).rpc(fn, args);
  if (error) return { ok: false, error: socialError(error.message) };
  return { ok: true, data: data as T };
}
const done = (r: { ok: boolean; error?: string }): ActionResult => {
  if (r.ok) revalidatePath("/tripulacao", "layout");
  return r.ok ? { ok: true } : { ok: false, error: r.error ?? "Erro." };
};

const profileSchema = z.object({
  username: z.string().trim().min(3).max(20),
  emoji: z.enum(AVATAR_EMOJIS),
  color: z.enum(Object.keys(AVATAR_COLORS) as [keyof typeof AVATAR_COLORS]),
});
export async function saveSocialProfileAction(input: unknown): Promise<ActionResult> {
  const p = profileSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Escolha um @apelido de 3 a 20 caracteres e um avatar." };
  return done(await rpc("social_set_profile", { p_username: p.data.username, p_avatar: { emoji: p.data.emoji, color: p.data.color } }));
}

export async function searchUsersAction(q: string): Promise<SearchCard[]> {
  const r = await rpc<SearchCard[]>("social_search", { p_q: String(q).slice(0, 30) });
  return r.ok ? r.data : [];
}

export async function friendRequestAction(username: string): Promise<ActionResult<string>> {
  const r = await rpc<string>("friend_request", { p_username: String(username).slice(0, 30) });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/tripulacao", "layout");
  return { ok: true, data: r.data };
}

export async function friendRespondAction(userId: string, action: "accept" | "decline" | "remove" | "block"): Promise<ActionResult> {
  if (!uuid.safeParse(userId).success || !["accept", "decline", "remove", "block"].includes(action)) return { ok: false, error: "Inválido." };
  return done(await rpc("friend_respond", { p_user: userId, p_action: action }));
}

export async function reportAction(userId: string, reason: "apelido" | "spam" | "assedio" | "outro"): Promise<ActionResult> {
  if (!uuid.safeParse(userId).success || !["apelido", "spam", "assedio", "outro"].includes(reason)) return { ok: false, error: "Inválido." };
  return done(await rpc("social_report", { p_user: userId, p_reason: reason }));
}

export async function sendBoostAction(to: string, kind: "vento" | "empurrao", message?: string): Promise<ActionResult> {
  if (!uuid.safeParse(to).success || !["vento", "empurrao"].includes(kind)) return { ok: false, error: "Inválido." };
  if (kind === "empurrao" && !(NUDGES as readonly string[]).includes(message ?? "")) return { ok: false, error: "Mensagem inválida." };
  return done(await rpc("send_boost", { p_to: to, p_kind: kind, p_message: kind === "empurrao" ? message : null }));
}

export async function reactAction(eventId: number, emoji: string): Promise<ActionResult<Record<string, number>>> {
  if (!Number.isInteger(eventId) || !(REACTIONS as readonly string[]).includes(emoji)) return { ok: false, error: "Inválido." };
  const r = await rpc<Record<string, number>>("react", { p_event: eventId, p_emoji: emoji });
  return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error };
}

const crewSchema = z.object({ name: z.string().trim().min(2).max(30), emoji: z.string().trim().min(1).max(8) });
export async function createCrewAction(input: unknown): Promise<ActionResult<string>> {
  const p = crewSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Dê um nome de 2 a 30 caracteres." };
  const r = await rpc<string>("crew_create", { p_name: p.data.name, p_emoji: p.data.emoji });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/tripulacao", "layout");
  return { ok: true, data: r.data };
}

export async function joinCrewAction(code: string): Promise<ActionResult<string>> {
  const c = String(code).trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(c)) return { ok: false, error: "O código tem 8 letras e números." };
  const r = await rpc<string>("crew_join", { p_code: c });
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/tripulacao", "layout");
  return { ok: true, data: r.data };
}

export async function leaveCrewAction(crewId: string) {
  if (!uuid.safeParse(crewId).success) return;
  await rpc("crew_leave", { p_crew: crewId });
  revalidatePath("/tripulacao", "layout");
  redirect("/tripulacao?aba=tripulacoes");
}
