import { NextResponse, type NextRequest } from "next/server";
import { notifyUser } from "@/lib/notify";
import { reminderText } from "@/lib/notifications";
import { TIERS } from "@/lib/social";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lembretes (cron com `Authorization: Bearer $CRON_SECRET`).
 * - Lembrete diário para quem ainda não estudou hoje, a partir do horário escolhido (1 por dia).
 * - Domingo a partir das 18h: posição na liga e quanto falta para subir (1 por semana).
 * Na Vercel Hobby o cron roda 1×/dia (19h de Brasília, vercel.json); com cron de hora em hora (Vercel Pro ou
 * Supabase pg_cron) cada aluno recebe no horário que escolheu.
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const now = new Date();
  const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const hour = Number(req.nextUrl.searchParams.get("hora") ?? sp.getHours());

  let reminders = 0, league = 0;
  const { data: due } = await admin.rpc("reminders_due", { p_hour: hour });
  for (const u of (due ?? []) as { user_id: string; first_name: string; streak: number }[]) {
    // registra antes de enviar: se duas execuções se cruzarem, só uma manda
    const { error } = await admin.from("notification_log").insert({ user_id: u.user_id, kind: "lembrete" });
    if (error) continue;
    const r = await notifyUser(u.user_id, "lembrete", reminderText(u.first_name, u.streak));
    if (r.push) reminders++;
  }

  if (sp.getDay() === 0 && hour >= 18) {
    const { data: rows } = await admin.rpc("league_standings");
    for (const s of (rows ?? []) as { user_id: string; tier: number; rank: number; size: number; week_xp: number; promo_xp: number }[]) {
      if (s.week_xp === 0) continue;
      const { error } = await admin.from("notification_log").insert({ user_id: s.user_id, kind: "liga" });
      if (error) continue;
      const tier = TIERS[s.tier];
      const body = s.rank <= 7
        ? `Você está em ${s.rank}º na liga ${tier.name} e na zona de subir! A semana fecha hoje à meia-noite.`
        : `Você está em ${s.rank}º na liga ${tier.name}. Faltam ${Math.max(1, s.promo_xp - s.week_xp + 1)} XP para entrar na zona de subir. Fecha hoje!`;
      const r = await notifyUser(s.user_id, "liga", { title: `${tier.emoji} Última chamada da liga`, body, url: "/tripulacao?aba=liga", tag: "liga" });
      if (r.push) league++;
    }
  }
  return NextResponse.json({ ok: true, hour, reminders, league });
}
