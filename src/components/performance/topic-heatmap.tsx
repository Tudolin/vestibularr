import { cn } from "@/lib/utils";

type T = { key: string; subject?: string; answered: number; correct: number };

/** Mapa de calor por assunto, agrupado por disciplina. Cor + % escrito (nunca só cor). */
export function TopicHeatmap({ topics }: { topics: T[] }) {
  const groups = new Map<string, T[]>();
  for (const t of topics) {
    const g = t.subject ?? "Outros";
    groups.set(g, [...(groups.get(g) ?? []), t]);
  }
  const tone = (p: number, n: number) =>
    n < 3 ? "bg-muted text-muted-foreground" : p >= 70 ? "bg-success-soft text-success-soft-foreground" : p >= 40 ? "bg-warning-soft text-warning-soft-foreground" : "bg-danger-soft text-danger-soft-foreground";
  return (
    <div className="grid gap-4">
      {[...groups.entries()].map(([g, list]) => (
        <section key={g} aria-label={g}>
          <h4 className="mb-2 text-sm font-bold">{g}</h4>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((t) => {
              const p = t.answered ? Math.round((t.correct / t.answered) * 100) : 0;
              return (
                <li key={t.key} className={cn("flex flex-col rounded-control p-2.5", tone(p, t.answered))} title={`${t.correct} de ${t.answered}`}>
                  <span className="truncate text-xs font-semibold">{t.key}</span>
                  <span className="text-lg font-extrabold">{t.answered < 3 ? "—" : `${p}%`}</span>
                  <span className="text-[11px] opacity-80">{t.answered} {t.answered === 1 ? "questão" : "questões"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span><span className="mr-1 inline-block size-3 rounded-sm bg-success-soft align-middle" />≥ 70%</span>
        <span><span className="mr-1 inline-block size-3 rounded-sm bg-warning-soft align-middle" />40–69%</span>
        <span><span className="mr-1 inline-block size-3 rounded-sm bg-danger-soft align-middle" />&lt; 40%</span>
        <span><span className="mr-1 inline-block size-3 rounded-sm bg-muted align-middle" />poucas questões</span>
      </p>
    </div>
  );
}
