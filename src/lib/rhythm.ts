/** Ritmo de estudo (migration 0023: _rhythm_segment) e pequenas leituras dos números para o admin. */
export const SEGMENTS = {
  constante: { label: "Constante", desc: "12+ dias de estudo nas últimas 4 semanas", tone: "success", bar: "bg-success" },
  regular: { label: "Regular", desc: "5 a 11 dias nas últimas 4 semanas", tone: "primary", bar: "bg-primary" },
  esporadico: { label: "Esporádico", desc: "1 a 4 dias nas últimas 4 semanas", tone: "warning", bar: "bg-gema" },
  parado: { label: "Parado", desc: "Não estuda há mais de 7 dias", tone: "danger", bar: "bg-danger" },
  nunca: { label: "Não começou", desc: "Ainda não respondeu nenhuma questão", tone: "neutral", bar: "bg-muted-foreground/40" },
} as const;
export type Segment = keyof typeof SEGMENTS;
export const SEGMENT_ORDER: Segment[] = ["constante", "regular", "esporadico", "parado", "nunca"];

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function ago(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const m = Math.floor(days / 30);
  return m === 1 ? "há 1 mês" : `há ${m} meses`;
}

/** Variação da semana em relação à anterior (null quando não dá para comparar). */
export function trend(now: number, prev: number): number | null {
  if (!prev) return now ? null : 0;
  return Math.round(((now - prev) / prev) * 100);
}

/** Período do dia em que mais estuda, a partir das 24 horas. */
export function peakPeriod(hours: number[]): string | null {
  const total = hours.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const parts: [string, number[]][] = [["de madrugada (0h–6h)", [0, 1, 2, 3, 4, 5]], ["de manhã (6h–12h)", [6, 7, 8, 9, 10, 11]], ["à tarde (12h–18h)", [12, 13, 14, 15, 16, 17]], ["à noite (18h–24h)", [18, 19, 20, 21, 22, 23]]];
  const [name, idx] = parts.map(([n, i]) => [n, i.reduce((a, h) => a + hours[h], 0)] as const).sort((a, b) => b[1] - a[1])[0];
  return `${name} · ${Math.round((idx / total) * 100)}% das questões`;
}

export function peakDay(weekdays: number[]): string | null {
  const max = Math.max(...weekdays);
  return max > 0 ? WEEKDAYS[weekdays.indexOf(max)] : null;
}

export type CohortStudent = {
  id: string; name: string | null; email: string | null; active: boolean; created_at: string; last_seen_at: string | null;
  last_at: string | null; days28: number; a7: number; prev7: number; a30: number; acc30: number | null; min7: number;
  segment: Segment; weakest: string | null; strongest: string | null; streak: number;
};

/** Motivo para o admin olhar o aluno agora (ou null). */
export function attentionReason(s: CohortStudent): string | null {
  if (!s.active) return null;
  if (s.segment === "parado") return `parou de estudar ${ago(s.last_at)}`;
  if (s.segment === "nunca" && Date.now() - new Date(s.created_at).getTime() > 3 * 86400000) return "criou a conta e ainda não começou";
  const t = trend(s.a7, s.prev7);
  if (t != null && t <= -50 && s.prev7 >= 10) return `estudou ${Math.abs(t)}% menos nesta semana`;
  if (s.acc30 != null && s.a30 >= 20 && s.acc30 < 40) return `acerto baixo (${s.acc30}%) no último mês`;
  return null;
}
