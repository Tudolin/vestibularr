"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Day = { day: string; answered: number; correct: number; seconds: number };

/** Últimas 8 semanas: barras = questões respondidas; linha = % de acerto da semana. */
export function AccuracyChart({ daily }: { daily: Day[] }) {
  const weeks: { label: string; answered: number; pct: number | null; minutes: number }[] = [];
  for (let i = daily.length - 56; i < daily.length; i += 7) {
    const slice = daily.slice(Math.max(i, 0), i + 7);
    if (!slice.length) continue;
    const a = slice.reduce((n, d) => n + d.answered, 0);
    const c = slice.reduce((n, d) => n + d.correct, 0);
    const [, m, dd] = slice[0].day.split("-");
    weeks.push({ label: `${dd}/${m}`, answered: a, pct: a ? Math.round((c / a) * 100) : null, minutes: Math.round(slice.reduce((n, d) => n + d.seconds, 0) / 60) });
  }
  const style = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" };
  return (
    <div className="h-64 w-full" role="img" aria-label="Questões por semana e porcentagem de acerto nas últimas 8 semanas">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={weeks} margin={{ top: 8, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
          <YAxis yAxisId="n" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" allowDecimals={false} />
          <YAxis yAxisId="p" orientation="right" domain={[0, 100]} unit="%" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
          <Tooltip contentStyle={style} formatter={(v, name) => (name === "Acerto" ? [`${v}%`, name] : [v, name])} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="n" dataKey="answered" name="Questões" fill="var(--primary-soft-foreground)" fillOpacity={0.35} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Line yAxisId="p" dataKey="pct" name="Acerto" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
