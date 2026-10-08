"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { n: number; seconds: number; result: "correct" | "wrong" | "blank" | "discursive" };
const COLOR = { correct: "var(--success)", wrong: "var(--danger)", blank: "var(--muted-foreground)", discursive: "var(--primary)" };
const LABEL = { correct: "acerto", wrong: "erro", blank: "em branco", discursive: "discursiva" };

/** Tempo por questão (barras coloridas pelo resultado; a legenda textual fica ao lado). */
export function TimeChart({ data }: { data: Point[] }) {
  return (
    <figure>
      <div className="h-56 w-full" role="img" aria-label={`Tempo por questão: ${data.length} questões`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="n" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" unit="s" />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }}
              formatter={(v, _n, item) => [`${v}s (${LABEL[(item.payload as Point).result]})`, `Questão ${(item.payload as Point).n}`]}
              labelFormatter={() => ""}
            />
            <Bar dataKey="seconds" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {data.map((d) => <Cell key={d.n} fill={COLOR[d.result]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((k) => (
          <span key={k} className="flex items-center gap-1"><span className="size-3 rounded-sm" style={{ background: COLOR[k] }} aria-hidden /> {LABEL[k]}</span>
        ))}
      </figcaption>
    </figure>
  );
}
