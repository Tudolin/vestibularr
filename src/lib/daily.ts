/** Desafio do dia (RPC daily_status). */
export type DailyStatus = {
  day: string; attempt_id: string | null; focus: string | null; total: number; answered: number;
  completed: boolean; correct: number | null; streak: number; studied_today: boolean; shields: number; days_done: number;
  week: { day: string; active: boolean; shield: boolean; daily: boolean }[];
};
export const WEEKDAY = ["D", "S", "T", "Q", "Q", "S", "S"];
