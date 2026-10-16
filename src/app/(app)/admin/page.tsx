import { AlertTriangle, ChevronRight, Flame, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AccuracyRow, Columns, SegmentBadge, SegmentBar, Stat } from "@/components/admin/analytics";
import { BoardFilter } from "@/components/performance/board-filter";
import { AREAS as AREA_UI } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpTip } from "@/components/ui/help-tip";
import { requireAdmin } from "@/lib/auth";
import { parseBoard } from "@/lib/boards";
import { ago, attentionReason, peakDay, peakPeriod, SEGMENT_ORDER, SEGMENTS, trend, WEEKDAYS, type CohortStudent, type Segment } from "@/lib/rhythm";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Painel do admin" };

type Acc = { key: string; subject?: string; answered: number; correct: number; students: number };
type Cohort = {
  totals: { students: number; active7: number; active30: number; new7: number; answers7: number; answers_prev7: number; acc30: number | null; per_active7: number | null; minutes7: number; daily7: number; daily_users7: number };
  segments: Partial<Record<Segment, number>> | null;
  daily: { day: string; students: number; answers: number; correct: number }[];
  hours: number[]; weekdays: number[];
  by_area: Acc[]; by_subject: Acc[]; weak_topics: Acc[]; strong_topics: Acc[];
  students: CohortStudent[];
};

const SORTS = { recente: "Último estudo", semana: "Mais questões na semana", acerto: "Menor acerto", nome: "Nome" } as const;
type Sort = keyof typeof SORTS;

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ vestibular?: string; ritmo?: string; ordem?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const board = parseBoard(sp.vestibular);
  const { data, error } = await (await createClient()).rpc("admin_cohort", { p_board: board });
  const c = data as Cohort | null;
  if (error || !c) {
    return <EmptyState icon={<Users aria-hidden />} title="Análise indisponível" description="Rode a migration 0023 (análise do admin) no Supabase." />;
  }
  const t = c.totals;
  const ritmo = SEGMENT_ORDER.find((s) => s === sp.ritmo);
  const sort: Sort = (Object.keys(SORTS) as Sort[]).find((k) => k === sp.ordem) ?? "recente";
  const attention = c.students.map((s) => ({ s, why: attentionReason(s) })).filter((x) => x.why);
  const list = c.students
    .filter((s) => !ritmo || s.segment === ritmo)
    .sort((a, b) => sort === "semana" ? b.a7 - a.a7
      : sort === "acerto" ? (a.acc30 ?? 999) - (b.acc30 ?? 999)
      : sort === "nome" ? (a.name || a.email || "").localeCompare(b.name || b.email || "", "pt-BR")
      : (b.last_at ? Date.parse(b.last_at) : 0) - (a.last_at ? Date.parse(a.last_at) : 0));
  const q = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams(Object.entries({ vestibular: board ?? undefined, ritmo, ordem: sort === "recente" ? undefined : sort, ...p }).filter(([, v]) => v) as [string, string][]);
    return `/admin${u.size ? `?${u}` : ""}`;
  };
  const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const period = peakPeriod(c.hours);
  const busiest = peakDay(c.weekdays);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Visão geral</h1>
          <p className="text-sm text-muted-foreground">Como a turma está estudando: ritmo, horários, pontos fortes e fracos. Toque num aluno para ver o painel dele.</p>
        </div>
        <BoardFilter base="/admin" board={board} />
      </header>

      <section aria-label="Números da turma" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Alunos" value={t.students} sub={`${t.new7} novos nos últimos 7 dias`} />
        <Stat label="Estudaram na semana" value={`${t.active7}`} sub={`${t.students ? Math.round((t.active7 / t.students) * 100) : 0}% da turma · ${t.active30} no mês`} />
        <Stat label="Questões na semana" value={t.answers7.toLocaleString("pt-BR")} delta={trend(t.answers7, t.answers_prev7)}
          sub={`${t.per_active7 ?? 0} por aluno ativo · ${t.minutes7 >= 60 ? `${Math.round(t.minutes7 / 60)} h` : `${t.minutes7} min`} de estudo`} />
        <Stat label="Acerto (30 dias)" value={t.acc30 != null ? `${t.acc30}%` : "—"} sub={`${plural(t.daily7, "desafio do dia", "desafios do dia")} em 7 dias (${plural(t.daily_users7, "aluno", "alunos")})`} />
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-1">Ritmo da turma <HelpTip topic="ritmo" /></CardTitle></CardHeader>
        <CardContent><SegmentBar counts={c.segments ?? {}} total={t.students} /></CardContent>
      </Card>

      {attention.length > 0 && (
        <Card className="border-warning-soft-foreground/30">
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-danger" aria-hidden /> Precisam de atenção ({attention.length}) <HelpTip topic="atencao" /></CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {attention.slice(0, 10).map(({ s, why }) => (
                <li key={s.id}>
                  <Link href={`/admin/alunos/${s.id}`} className="flex items-center gap-2 rounded-control p-2 text-sm hover:bg-muted">
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{s.name || s.email}</span><span className="text-muted-foreground">{why}</span></span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Questões por dia (30 dias)</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Columns title={`Questões por dia nos últimos 30 dias: ${c.daily.reduce((a, d) => a + d.answers, 0)} no total`}
              values={c.daily.map((d) => d.answers)}
              labels={c.daily.map((d) => `${dayLabel(d.day)}: ${d.answers} questões, ${d.students} alunos${d.answers ? `, ${Math.round((d.correct / d.answers) * 100)}% de acerto` : ""}`)}
              ticks={c.daily.map((d, i) => (i % 5 === 0 || i === c.daily.length - 1 ? dayLabel(d.day) : null))} />
            <p className="text-xs text-muted-foreground">Passe o dedo ou o mouse numa coluna para ver o dia.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Quando a turma estuda</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Columns title="Questões por hora do dia" height="h-20" tone="bg-[var(--area-linguagens)]" values={c.hours}
              labels={c.hours.map((n, h) => `${h}h: ${n} questões`)} ticks={c.hours.map((_, h) => (h % 6 === 0 ? `${h}h` : null))} />
            <Columns title="Questões por dia da semana" height="h-16" tone="bg-[var(--area-natureza)]" values={c.weekdays}
              labels={c.weekdays.map((n, i) => `${WEEKDAYS[i]}: ${n} questões`)} ticks={WEEKDAYS} />
            {period && <p className="text-sm">Estudam mais <strong>{period}</strong>{busiest ? <>, principalmente <strong>{busiest}</strong></> : null}.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Acerto por área (90 dias)</CardTitle></CardHeader>
          <CardContent>
            {c.by_area.length ? (
              <ul className="grid gap-3">
                {c.by_area.map((a) => <AccuracyRow key={a.key} label={AREA_UI[a.key as keyof typeof AREA_UI]?.label ?? a.key} correct={a.correct} answered={a.answered} extra={` · ${plural(a.students, "aluno", "alunos")}`} />)}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Sem respostas ainda.</p>}
            {c.by_subject.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-primary">Ver por disciplina</summary>
                <ul className="mt-3 grid gap-3">
                  {c.by_subject.map((a) => <AccuracyRow key={a.key} label={a.key} correct={a.correct} answered={a.answered} extra={` · ${plural(a.students, "aluno", "alunos")}`} />)}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
        <TopicCard title="Mais difíceis para a turma" help items={c.weak_topics} empty="Ainda não há respostas suficientes por assunto." />
        <TopicCard title="Onde a turma vai bem" items={c.strong_topics} empty="Ainda não há respostas suficientes por assunto." />
      </div>

      <section aria-labelledby="alunos" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="alunos" className="text-lg font-bold">Alunos ({list.length})</h2>
          <nav aria-label="Ordenar" className="flex flex-wrap gap-1 text-sm">
            {(Object.keys(SORTS) as Sort[]).map((k) => (
              <Link key={k} href={q({ ordem: k === "recente" ? undefined : k })} aria-current={sort === k ? "true" : undefined}
                className={cn("rounded-full px-3 py-1.5 font-semibold", sort === k ? "bg-primary-soft text-primary-soft-foreground" : "text-muted-foreground hover:bg-muted")}>{SORTS[k]}</Link>
            ))}
          </nav>
        </div>
        <nav aria-label="Filtrar por ritmo" className="flex flex-wrap gap-2">
          <Link href={q({ ritmo: undefined })} aria-current={!ritmo ? "true" : undefined}
            className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", !ritmo ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-input hover:bg-muted")}>Todos</Link>
          {SEGMENT_ORDER.map((s) => (
            <Link key={s} href={q({ ritmo: s })} aria-current={ritmo === s ? "true" : undefined}
              className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", ritmo === s ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-input hover:bg-muted")}>
              {SEGMENTS[s].label} ({c.segments?.[s] ?? 0})
            </Link>
          ))}
        </nav>
        {list.length === 0 ? (
          <EmptyState icon={<Users aria-hidden />} title="Nenhum aluno aqui" description="Mude o filtro de ritmo." />
        ) : (
          <ul className="grid gap-2">
            {list.map((s) => {
              const d = trend(s.a7, s.prev7);
              return (
                <li key={s.id}>
                  <Link href={`/admin/alunos/${s.id}${board ? `?vestibular=${board}` : ""}`}
                    className="grid gap-2 rounded-card border border-border bg-card p-4 hover:border-primary sm:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] sm:items-center">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2"><span className="truncate font-bold">{s.name || s.email}</span><SegmentBadge s={s.segment} />{!s.active && <span className="text-xs text-danger">desativado</span>}</span>
                      <span className="block text-xs text-muted-foreground">{s.last_at ? `estudou ${ago(s.last_at)}` : "ainda não estudou"}{s.weakest ? ` · mais fraco: ${s.weakest}` : ""}</span>
                    </span>
                    <Cell label="dias (4 sem.)" value={`${s.days28}/28`} />
                    <Cell label="questões 7 dias" value={<>{s.a7}{d != null && d !== 0 && <span className={cn("ml-1 text-xs", d > 0 ? "text-success" : "text-danger")}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}%</span>}</>} />
                    <Cell label="acerto 30 dias" value={s.acc30 != null ? `${s.acc30}%` : "—"} />
                    <Cell label="sequência" value={<span className="inline-flex items-center gap-1"><Flame className="size-3.5 text-orange-500" aria-hidden />{s.streak}</span>} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="flex items-baseline justify-between gap-2 text-sm sm:flex-col sm:items-start sm:gap-0">
      <span className="text-xs text-muted-foreground sm:order-2">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </span>
  );
}

function TopicCard({ title, items, empty, help }: { title: string; items: Acc[]; empty: string; help?: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-1">{title}{help && <HelpTip topic="turma_fracos" />}</CardTitle></CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="grid gap-3">{items.map((a) => <AccuracyRow key={`${a.subject}-${a.key}`} label={a.key} sub={a.subject} correct={a.correct} answered={a.answered} extra={` · ${plural(a.students, "aluno", "alunos")}`} />)}</ul>
        ) : <p className="text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  );
}
