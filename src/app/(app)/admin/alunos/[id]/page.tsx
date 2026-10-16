import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoardFilter } from "@/components/performance/board-filter";
import { PerformanceDashboard } from "@/components/performance/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseBoard } from "@/lib/boards";
import { AccuracyRow, Columns, SegmentBadge, Stat, StudyCalendar } from "@/components/admin/analytics";
import { HelpTip } from "@/components/ui/help-tip";
import { ago, peakDay, peakPeriod, SEGMENTS, trend, WEEKDAYS, type Segment } from "@/lib/rhythm";

export const metadata: Metadata = { title: "Aluno (admin)" };
const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function AdminAluno({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vestibular?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { vestibular } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const board = parseBoard(vestibular);
  const supabase = await createClient();
  const [{ data: p }, { data: logs }, { data: attempts }, { data: rh }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", id).maybeSingle(),
    supabase.from("access_logs").select("event, path, device, at").eq("user_id", id).order("at", { ascending: false }).limit(30),
    supabase.from("exam_attempts").select("id, title, mode, status, score, finished_at, started_at").eq("user_id", id).order("started_at", { ascending: false }).limit(15),
    supabase.rpc("admin_student_rhythm", { p_user: id, p_board: board }),
  ]);
  const r = rh as Rhythm | null;
  if (!p) notFound();
  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start"><Link href="/admin"><ArrowLeft aria-hidden /> Visão geral</Link></Button>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold md:text-3xl">{p.full_name || p.email}</h1><p className="text-sm text-muted-foreground">{p.email}</p></div>
        <BoardFilter base={`/admin/alunos/${id}`} board={board} />
      </header>
      {r && <RhythmSection r={r} />}
      <PerformanceDashboard userId={id} board={board} editable={false} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Simulados e treinos</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm">
              {(attempts ?? []).map((a) => {
                const s = a.score as { correct: number; total: number } | null;
                return (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2">
                    <span>{a.title} <span className="text-xs text-muted-foreground">({a.mode})</span></span>
                    <span className="font-semibold">{s ? `${s.correct}/${s.total}` : a.status === "in_progress" ? "em andamento" : a.status}</span>
                  </li>
                );
              })}
              {(attempts ?? []).length === 0 && <li className="text-muted-foreground">Nenhuma tentativa.</li>}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Últimos acessos</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {(logs ?? []).map((l, i) => (
                <li key={i} className="flex justify-between gap-2"><span>{l.event === "login" ? "🔑 login" : l.path}</span><span className="text-xs text-muted-foreground">{l.device ?? ""} · {fmt.format(new Date(l.at))}</span></li>
              ))}
              {(logs ?? []).length === 0 && <li className="text-muted-foreground">Nenhum acesso registrado.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type Rhythm = {
  calendar: { day: string; answers: number; correct: number; minutes: number }[];
  hours: number[]; weekdays: number[];
  summary: { last_at: string | null; days28: number; a7: number; prev7: number; acc7: number | null; acc_prev7: number | null; per_day: number | null; min_per_day: number | null; sec_per_q: number | null; segment: Segment };
  subjects: { key: string; answered: number; correct: number; recent: number; recent_correct: number }[];
};

/** Ritmo de estudo do aluno: constância, calendário de 12 semanas, horários e matérias (com a tendência recente). */
function RhythmSection({ r }: { r: Rhythm }) {
  const s = r.summary;
  const period = peakPeriod(r.hours);
  const busiest = peakDay(r.weekdays);
  const activeDays = r.calendar.filter((d) => d.answers > 0).length;
  const accDelta = s.acc7 != null && s.acc_prev7 != null ? s.acc7 - s.acc_prev7 : null;
  return (
    <section aria-labelledby="ritmo" className="flex flex-col gap-4">
      <h2 id="ritmo" className="flex flex-wrap items-center gap-2 text-xl font-extrabold">Ritmo de estudo <SegmentBadge s={s.segment} /><HelpTip topic="ritmo" /></h2>
      <p className="-mt-2 text-sm text-muted-foreground">{SEGMENTS[s.segment].desc}. Último estudo: {ago(s.last_at)}.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Dias de estudo (4 semanas)" value={`${s.days28}/28`} />
        <Stat label="Questões na semana" value={s.a7} delta={trend(s.a7, s.prev7)} sub={`${s.prev7} na semana anterior`} />
        <Stat label="Acerto na semana" value={s.acc7 != null ? `${s.acc7}%` : "—"} delta={accDelta} sub={s.acc_prev7 != null ? `${s.acc_prev7}% na anterior (pontos)` : undefined} />
        <Stat label="Por dia de estudo" value={`${s.per_day ?? 0} questões`} sub={`~${s.min_per_day ?? 0} min · ${s.sec_per_q ?? 0} s por questão`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Calendário (12 semanas)</CardTitle></CardHeader>
          <CardContent>
            <p className="sr-only">{activeDays} dias com estudo nas últimas 12 semanas.</p>
            <StudyCalendar days={r.calendar} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Quando estuda (60 dias)</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Columns title="Questões por hora do dia" height="h-16" tone="bg-[var(--area-linguagens)]" values={r.hours}
              labels={r.hours.map((n, h) => `${h}h: ${n} questões`)} ticks={r.hours.map((_, h) => (h % 6 === 0 ? `${h}h` : null))} />
            <Columns title="Questões por dia da semana" height="h-12" tone="bg-[var(--area-natureza)]" values={r.weekdays}
              labels={r.weekdays.map((n, i) => `${WEEKDAYS[i]}: ${n} questões`)} ticks={WEEKDAYS} />
            {period ? <p className="text-sm">Estuda mais <strong>{period}</strong>{busiest ? <>, principalmente <strong>{busiest}</strong></> : null}.</p>
              : <p className="text-sm text-muted-foreground">Sem estudo nos últimos 60 dias.</p>}
          </CardContent>
        </Card>
      </div>
      {r.subjects.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Matérias: do mais fraco ao mais forte (120 dias)</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-3 md:grid-cols-2">
              {r.subjects.map((x) => {
                const recent = x.recent ? Math.round((x.recent_correct / x.recent) * 100) : null;
                const all = Math.round((x.correct / x.answered) * 100);
                return (
                  <AccuracyRow key={x.key} label={x.key} correct={x.correct} answered={x.answered}
                    extra={recent != null && x.recent >= 3 ? ` · últimas 2 semanas: ${recent}% ${recent > all ? "▲" : recent < all ? "▼" : ""}` : ""} />
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
