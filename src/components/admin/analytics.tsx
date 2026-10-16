import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SEGMENT_ORDER, SEGMENTS, WEEKDAYS, type Segment } from "@/lib/rhythm";
import { cn } from "@/lib/utils";

/** Peças visuais da análise do admin. Gráficos em CSS puro: leves e renderizados no servidor. */

export function Stat({ label, value, sub, delta }: { label: string; value: React.ReactNode; sub?: React.ReactNode; delta?: number | null }) {
  return (
    <Card className="flex flex-col gap-0.5 p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-2 text-2xl font-extrabold tabular-nums">{value}{delta !== undefined && <Delta v={delta} />}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </Card>
  );
}

export function Delta({ v, suffix = "%" }: { v: number | null; suffix?: string }) {
  if (v == null) return null;
  const Icon = v > 0 ? ArrowUp : v < 0 ? ArrowDown : Minus;
  return (
    <span className={cn("inline-flex items-center text-sm font-bold", v > 0 ? "text-success" : v < 0 ? "text-danger" : "text-muted-foreground")}
      aria-label={`${v > 0 ? "subiu" : v < 0 ? "caiu" : "igual"} ${Math.abs(v)}${suffix} em relação à semana anterior`}>
      <Icon className="size-3.5" aria-hidden />{Math.abs(v)}{suffix}
    </span>
  );
}

export function SegmentBadge({ s }: { s: Segment }) {
  return <Badge tone={SEGMENTS[s].tone}>{SEGMENTS[s].label}</Badge>;
}

/** Barra empilhada com quantos alunos há em cada ritmo. */
export function SegmentBar({ counts, total }: { counts: Partial<Record<Segment, number>>; total: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-5 overflow-hidden rounded-full bg-muted" role="img"
        aria-label={SEGMENT_ORDER.map((s) => `${SEGMENTS[s].label}: ${counts[s] ?? 0}`).join(", ")}>
        {SEGMENT_ORDER.map((s) => (counts[s] ?? 0) > 0 && <div key={s} className={SEGMENTS[s].bar} style={{ width: `${((counts[s] ?? 0) / Math.max(total, 1)) * 100}%` }} />)}
      </div>
      <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {SEGMENT_ORDER.map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span className={cn("size-3 shrink-0 rounded-sm", SEGMENTS[s].bar)} aria-hidden />
            <span className="font-bold tabular-nums">{counts[s] ?? 0}</span> {SEGMENTS[s].label}
            <span className="truncate text-xs text-muted-foreground">· {SEGMENTS[s].desc}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Colunas verticais (ex.: questões por dia). `label` vira o rótulo de acessibilidade de cada coluna. */
export function Columns({ values, labels, ticks, height = "h-32", tone = "bg-primary", title }: {
  values: number[]; labels: string[]; ticks?: (string | null)[]; height?: string; tone?: string; title: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <figure className="flex flex-col gap-1">
      <div className={cn("flex items-end gap-[2px]", height)} role="img" aria-label={title}>
        {values.map((v, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end" title={labels[i]}>
            <div className={cn("w-full rounded-t-sm", v ? tone : "bg-muted")} style={{ height: `${v ? Math.max(4, (v / max) * 100) : 3}%` }} />
          </div>
        ))}
      </div>
      {ticks && (
        <div className="flex gap-[2px] text-[10px] text-muted-foreground" aria-hidden>
          {ticks.map((t, i) => <span key={i} className="flex-1 text-center">{t ?? ""}</span>)}
        </div>
      )}
    </figure>
  );
}

/** Linha de porcentagem de acerto (barra horizontal). */
export function AccuracyRow({ label, sub, correct, answered, extra }: { label: string; sub?: string; correct: number; answered: number; extra?: React.ReactNode }) {
  const p = answered ? Math.round((correct / answered) * 100) : 0;
  const tone = p >= 70 ? "bg-success" : p >= 40 ? "bg-gema" : "bg-danger";
  return (
    <li className="flex flex-col gap-1 text-sm">
      <span className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="min-w-0"><span className="font-semibold">{label}</span>{sub && <span className="ml-1 text-xs text-muted-foreground">{sub}</span>}</span>
        <span className="tabular-nums"><strong>{p}%</strong> <span className="text-xs text-muted-foreground">({correct}/{answered}){extra}</span></span>
      </span>
      <span className="h-2 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full", tone)} style={{ width: `${p}%` }} /></span>
    </li>
  );
}

/** Calendário estilo "contribuições": 12 semanas, uma coluna por semana, uma linha por dia da semana. */
export function StudyCalendar({ days }: { days: { day: string; answers: number; correct: number; minutes: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.answers));
  const first = new Date(`${days[0].day}T12:00:00`).getDay();
  const cells: (typeof days[number] | null)[] = [...Array(first).fill(null), ...days];
  const weeks: (typeof days[number] | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const level = (n: number) => (n === 0 ? "bg-muted" : n / max < 0.25 ? "bg-primary/30" : n / max < 0.5 ? "bg-primary/55" : n / max < 0.75 ? "bg-primary/80" : "bg-primary");
  const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return (
    <figure className="flex flex-col gap-2">
      <div className="flex gap-1 overflow-x-auto pb-1">
        <div className="grid shrink-0 grid-rows-7 gap-1 pr-1 text-[10px] leading-3 text-muted-foreground" aria-hidden>
          {WEEKDAYS.map((w, i) => <span key={w} className="h-3">{i % 2 ? w : ""}</span>)}
        </div>
        {weeks.map((w, i) => (
          <div key={i} className="grid shrink-0 grid-rows-7 gap-1">
            {Array.from({ length: 7 }, (_, j) => {
              const d = w[j];
              return d ? (
                <span key={j} className={cn("size-3 rounded-[3px]", level(d.answers))}
                  title={`${fmt(d.day)}: ${d.answers} questões${d.answers ? `, ${Math.round((d.correct / d.answers) * 100)}% de acerto, ${d.minutes} min` : ""}`} />
              ) : <span key={j} className="size-3" />;
            })}
          </div>
        ))}
      </div>
      <figcaption className="flex items-center gap-1 text-xs text-muted-foreground">
        Menos {["bg-muted", "bg-primary/30", "bg-primary/55", "bg-primary/80", "bg-primary"].map((c) => <span key={c} className={cn("size-3 rounded-[3px]", c)} aria-hidden />)} Mais
      </figcaption>
    </figure>
  );
}
