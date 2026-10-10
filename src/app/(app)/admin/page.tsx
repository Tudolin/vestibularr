import { AlertTriangle, Clock, Flame, MonitorSmartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BoardFilter } from "@/components/performance/board-filter";
import { AREAS as AREA_UI, Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DEFAULT_GOALS, type GoalKind } from "@/lib/achievements";
import { requireAdmin } from "@/lib/auth";
import { pct, type Stats } from "@/lib/performance";
import { createClient } from "@/lib/supabase/server";
import { Users } from "lucide-react";

export const metadata: Metadata = { title: "Painel do admin" };

type Row = { id: string; name: string; email: string; active: boolean; last_seen_at: string | null; last_device: string | null; logins_7d: number; stats: Stats; weak_topics: { key: string; answered: number; correct: number }[] };
const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ vestibular?: string }> }) {
  await requireAdmin();
  const { vestibular } = await searchParams;
  const board = vestibular === "ENEM" || vestibular === "UFPR" ? vestibular : null;
  const { data } = await (await createClient()).rpc("admin_overview", { p_board: board });
  const rows = (data ?? []) as Row[];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Visão geral</h1>
          <p className="text-sm text-muted-foreground">Progresso de cada aluno. Toque num aluno para ver o painel completo e os acessos.</p>
        </div>
        <BoardFilter base="/admin" board={board} />
      </header>
      {rows.length === 0 ? (
        <EmptyState icon={<Users aria-hidden />} title="Nenhum aluno" description="Crie contas em Alunos." />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => {
            const s = r.stats;
            const g = { ...DEFAULT_GOALS, ...s.goals };
            const prog: Record<GoalKind, number> = { questions_day: s.week.answered_today, questions_week: s.week.answered, minutes_week: s.week.minutes, essays_week: s.week.essays };
            const met = (Object.keys(g) as GoalKind[]).filter((k) => prog[k] >= g[k]).length;
            return (
              <li key={r.id}>
                <Card className="lift focus-within:border-primary hover:border-primary">
                  <Link href={`/admin/alunos/${r.id}${board ? `?vestibular=${board}` : ""}`} className="flex flex-col gap-3 rounded-card p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="flex-1 text-lg font-bold">{r.name || r.email}</p>
                      {!r.active && <Badge tone="danger">desativado</Badge>}
                      <Badge tone={s.streak.current > 0 ? "warning" : "neutral"}><Flame className="size-3" aria-hidden /> {s.streak.current} dias</Badge>
                    </div>
                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="size-3" aria-hidden /> último acesso: {r.last_seen_at ? fmt.format(new Date(r.last_seen_at)) : "nunca"}</span>
                      <span className="flex items-center gap-1"><MonitorSmartphone className="size-3" aria-hidden /> {r.last_device ?? "—"} · {r.logins_7d} logins em 7 dias</span>
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-control bg-muted p-2"><p className="text-lg font-extrabold">{s.totals.answered}</p><p className="text-xs text-muted-foreground">questões · {pct(s.totals.correct, s.totals.answered)}%</p></div>
                      <div className="rounded-control bg-muted p-2"><p className="text-lg font-extrabold">{s.attempts.simulados}</p><p className="text-xs text-muted-foreground">simulados</p></div>
                      <div className="rounded-control bg-muted p-2"><p className="text-lg font-extrabold">{(s.essays.enem?.count ?? 0) + (s.essays.ufpr?.count ?? 0)}</p><p className="text-xs text-muted-foreground">redações{s.essays.enem?.avg_total ? ` · ENEM ${s.essays.enem.avg_total}` : ""}</p></div>
                    </div>
                    {s.by_area.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {s.by_area.map((a) => <Badge key={`${a.board}${a.key}`} tone={AREA_UI[a.key as keyof typeof AREA_UI]?.tone ?? "neutral"}>{AREA_UI[a.key as keyof typeof AREA_UI]?.label ?? a.key} {pct(a.correct, a.answered)}%</Badge>)}
                      </div>
                    )}
                    <p className="text-sm">Metas da semana: <strong>{met}/4</strong> cumpridas · {s.week.minutes} min de estudo</p>
                    {r.weak_topics.length > 0 && (
                      <p className="flex flex-wrap items-center gap-1 text-sm"><AlertTriangle className="size-4 text-danger" aria-hidden /> Mais fracos: {r.weak_topics.map((t) => `${t.key} (${pct(t.correct, t.answered)}%)`).join(", ")}</p>
                    )}
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
