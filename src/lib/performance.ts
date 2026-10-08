import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Bands } from "@/lib/scoring/enem";

export type Bucket = { key: string; board?: string; subject?: string; answered: number; correct: number };
export type Stats = {
  user_id: string;
  board: string | null;
  totals: { answered: number; correct: number; time_ms: number };
  by_area: Bucket[];
  by_subject: Bucket[];
  by_topic: Bucket[];
  daily: { day: string; answered: number; correct: number; seconds: number }[];
  streak: { current: number; best: number; studied_today: boolean };
  week: { answered: number; answered_today: number; minutes: number; essays: number };
  goals: Partial<Record<"questions_day" | "questions_week" | "minutes_week" | "essays_week", number>>;
  attempts: { finished: number; simulados: number };
  errors: { pending: number; resolved: number };
  essays: {
    enem: { count: number; avg_total: number | null; best: number | null; avg_scores: Record<string, number> | null };
    ufpr: { count: number; avg_pct: number | null };
  };
};

export async function getStats(userId: string | null, board: "ENEM" | "UFPR" | null): Promise<Stats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_stats", { p_user: userId, p_board: board });
  if (error) throw new Error(error.message);
  return data as Stats;
}

export async function getBands(): Promise<Bands | undefined> {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("value").eq("key", "enem_score_bands").maybeSingle();
  return (data?.value as Bands) ?? undefined;
}

export const pct = (c: number, a: number) => (a ? Math.round((c / a) * 100) : 0);
