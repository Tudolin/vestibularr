/**
 * Planos e limites exibidos na vitrine (landing) e na tela de planos. O banco (plans/plan_limits) é a
 * fonte de verdade para as checagens; tests/db/plans.test.ts garante que este espelho bate com o seed.
 */
export type Feature = "simulado" | "essay_ai" | "transcribe" | "tutor_msg" | "export" | "export_size" | "study_plan" | "triagem" | "triagem_report";
export type Period = "day" | "week" | "month" | "none";
export type Limit = { period: Period; quota: number | null }; // null = ilimitado, 0 = indisponível

export type Plan = { code: "free" | "estudante" | "pro" | "familia"; name: string; priceCents: number; priceYearCents: number | null; tagline: string; limits: Record<Feature, Limit> };

const L = (period: Period, quota: number | null): Limit => ({ period, quota });

export const PLANS: Plan[] = [
  { code: "free", name: "Grátis", priceCents: 0, priceYearCents: null, tagline: "Para começar hoje",
    limits: { simulado: L("month", 1), essay_ai: L("week", 1), transcribe: L("week", 2), tutor_msg: L("day", 5), export: L("month", 5), export_size: L("none", 20), study_plan: L("month", 0), triagem: L("month", 1), triagem_report: L("none", 0) } },
  { code: "estudante", name: "Estudante", priceCents: 990, priceYearCents: 7900, tagline: "Para a rotina de estudos",
    limits: { simulado: L("month", null), essay_ai: L("week", 3), transcribe: L("week", 6), tutor_msg: L("day", 40), export: L("month", 10), export_size: L("none", 180), study_plan: L("month", 0), triagem: L("month", 2), triagem_report: L("none", null) } },
  { code: "pro", name: "Pro", priceCents: 1990, priceYearCents: 15900, tagline: "IA à vontade para acelerar",
    limits: { simulado: L("month", null), essay_ai: L("day", 2), transcribe: L("day", 4), tutor_msg: L("day", 150), export: L("month", null), export_size: L("none", 180), study_plan: L("month", null), triagem: L("month", null), triagem_report: L("none", null) } },
  { code: "familia", name: "Família", priceCents: 2990, priceYearCents: null, tagline: "Até 4 contas com o Pro",
    limits: { simulado: L("month", null), essay_ai: L("day", 2), transcribe: L("day", 4), tutor_msg: L("day", 150), export: L("month", null), export_size: L("none", 180), study_plan: L("month", null), triagem: L("month", null), triagem_report: L("none", null) } },
];

const PER: Record<Period, string> = { day: "por dia", week: "por semana", month: "por mês", none: "" };

/** "3 por semana", "ilimitado", "—" */
export function describeLimit(l: Limit, unit = ""): string {
  if (l.quota === null) return "ilimitado";
  if (l.quota === 0) return "—";
  return `${l.quota}${unit ? ` ${unit}` : ""} ${PER[l.period]}`.trim();
}

export const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const PERIOD_LABEL: Record<Period, string> = { day: "hoje", week: "esta semana", month: "este mês", none: "" };
