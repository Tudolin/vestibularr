"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type EvoPoint = { date: string; pct: number; c1?: number; c2?: number; c3?: number; c4?: number; c5?: number };

const SERIES = [
  { key: "c1", name: "C1", color: "var(--area-linguagens)" },
  { key: "c2", name: "C2", color: "var(--area-humanas)" },
  { key: "c3", name: "C3", color: "var(--area-natureza)" },
  { key: "c4", name: "C4", color: "var(--area-matematica)" },
  { key: "c5", name: "C5", color: "var(--danger)" },
];

/** Evolução por correção: ENEM mostra as 5 competências (0–200); UFPR mostra % da nota. */
export function EvolutionChart({ data, kind }: { data: EvoPoint[]; kind: "enem" | "ufpr" }) {
  const tooltipStyle = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" };
  return (
    <div className="h-64 w-full" role="img" aria-label={`Evolução das notas em ${data.length} correções`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
          {kind === "enem" ? (
            <>
              <YAxis domain={[0, 200]} ticks={[0, 40, 80, 120, 160, 200]} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {SERIES.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} />)}
            </>
          ) : (
            <>
              <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Nota"]} />
              <Line type="monotone" dataKey="pct" name="Nota" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
