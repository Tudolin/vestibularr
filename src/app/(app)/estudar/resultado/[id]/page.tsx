import { ArrowLeft, Clock, Download, Info, RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { QuestionView, areaBadge } from "@/components/question-view";
import { TimeChart } from "@/components/charts-lazy";
import { AREAS as AREA_UI, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatClock } from "@/lib/attempt/timer";
import { groupBy, totals, type Row } from "@/lib/scoring/aggregate";
import { computeMastery } from "@/lib/mastery";
import { estimateEnem, TRI_NOTICE, TRI_OFFICIAL_NOTICE, type Area } from "@/lib/scoring/enem";
import { ufprScore } from "@/lib/scoring/ufpr";
import { createClient } from "@/lib/supabase/server";
import { aiConfigured } from "@/lib/ai/gemini";
import { DiscursiveAi } from "./discursive-ai";
import { RetryButton } from "./retry-button";
import { DailyDone } from "@/components/daily/daily-done";
import type { DailyStatus } from "@/lib/daily";

export const metadata: Metadata = { title: "Resultado" };
// A correção das discursivas por IA é disparada desta página (roda depois da resposta).
export const maxDuration = 60;

type QRow = {
  position: number;
  question: {
    id: string; number: number | null; year: number | null; area: string | null; subject: string | null; topic: string | null;
    kind: "objective" | "discursive"; statement_md: string; irt_a: number | null; irt_b: number | null; irt_c: number | null; board: { code: string } | null;
    alternatives: { id: string; label: string; text_md: string; image_url: string | null }[];
  };
};

const AREA_BAR: Record<string, string> = { linguagens: "bg-area-linguagens", humanas: "bg-area-humanas", natureza: "bg-area-natureza", matematica: "bg-area-matematica" };

export default async function ResultadoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ filtro?: string }> }) {
  const { id } = await params;
  const { filtro = "todas" } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: state, error } = await supabase.rpc("attempt_state", { p_attempt: id });
  if (error || !state) notFound();
  if (state.attempt.status === "in_progress" || state.attempt.status === "paused") redirect(`/prova/${id}`);

  const [{ data: qrows }, { data: keys }] = await Promise.all([
    supabase
      .from("attempt_questions")
      .select("position, question:questions(id, number, year, area, subject, topic, kind, statement_md, irt_a, irt_b, irt_c, board:exam_boards(code), alternatives(id, label, text_md, image_url))")
      .eq("attempt_id", id)
      .order("position"),
    supabase.from("answer_keys").select("question_id, correct_label, explanation_md, official_mirror_md"),
  ]);
  const keyOf = new Map((keys ?? []).map((k) => [k.question_id, k]));
  const ans = new Map((state.answers as { question_id: string; choice: string | null; discursive_text: string | null; time_spent_ms: number }[]).map((a) => [a.question_id, a]));
  const list = (qrows ?? []) as unknown as QRow[];

  const rows: Row[] = list.map(({ question: q }) => ({
    question_id: q.id, area: q.area, subject: q.subject, topic: q.topic, kind: q.kind,
    choice: ans.get(q.id)?.choice ?? null, correct: keyOf.get(q.id)?.correct_label ?? null,
    time_spent_ms: Number(ans.get(q.id)?.time_spent_ms ?? 0),
  }));
  const t = totals(rows);
  const byArea = groupBy(rows, (r) => r.area).filter((b) => b.key !== "Sem classificação");
  const bySubject = groupBy(rows, (r) => r.subject);
  const byTopic = groupBy(rows, (r) => r.topic).filter((b) => b.key !== "Sem classificação");
  const totalTime = rows.reduce((s, r) => s + r.time_spent_ms, 0);

  const boards = new Set(list.map((r) => r.question.board?.code));
  const isEnem = boards.size === 1 && boards.has("ENEM");
  const isUfpr = boards.size === 1 && boards.has("UFPR");
  const linear = isEnem ? estimateEnem(Object.fromEntries(byArea.map((b) => [b.key, { correct: b.correct, total: b.total }])) as Record<Area, { correct: number; total: number }>) : null;
  // TRI com os parâmetros oficiais do INEP (questão em branco conta como erro, como no ENEM)
  const tri = isEnem
    ? computeMastery(list.flatMap(({ question: q }, i) => q.kind !== "objective" ? [] : [{
        board: "ENEM", area: q.area, subject: q.subject, topic: q.topic, irt_a: q.irt_a, irt_b: q.irt_b, irt_c: q.irt_c,
        ok: rows[i].choice != null && rows[i].choice === rows[i].correct,
      }])).areas.filter((a) => a.official > 0)
    : [];
  const enem = linear ? (() => {
    const areas: Partial<Record<Area, number>> = { ...linear.areas, ...Object.fromEntries(tri.map((a) => [a.area, a.score])) };
    const vals = Object.values(areas);
    return { areas, average: vals.length ? Math.round(vals.reduce((x, y) => x + y, 0) / vals.length) : null, official: tri.length > 0 };
  })() : null;
  const ufpr = isUfpr && bySubject.length ? ufprScore({ bySubject: Object.fromEntries(bySubject.map((b) => [b.key, { correct: b.correct, total: b.total }])) }) : null;

  const discursive = list.filter((r) => r.question.kind === "discursive");
  const chart = list.map(({ question: q }, i) => {
    const r = rows[i];
    return { n: i + 1, seconds: Math.round(r.time_spent_ms / 1000), result: (q.kind === "discursive" ? "discursive" : !r.choice ? "blank" : r.choice === r.correct ? "correct" : "wrong") as "correct" | "wrong" | "blank" | "discursive" };
  });
  const filtered = list.filter(({ question: q }, i) => {
    const r = rows[i];
    if (filtro === "erradas") return q.kind === "objective" && !!r.choice && r.choice !== r.correct;
    if (filtro === "branco") return q.kind === "objective" ? !r.choice : !ans.get(q.id)?.discursive_text?.trim();
    return true;
  });
  const wrongOrBlank = t.wrong + t.blank;
  // desafio do dia de hoje: mostra a sequência e os escudos
  const daily = state.attempt.config?.daily ? ((await supabase.rpc("daily_status")).data as DailyStatus | null) : null;
  const dailyToday = daily && daily.attempt_id === id && daily.completed ? daily : null;

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start"><Link href="/estudar"><ArrowLeft aria-hidden /> Estudar</Link></Button>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold md:text-3xl">{state.attempt.title}</h1>
        <p className="text-muted-foreground">{state.attempt.status === "expired" ? "Encerrada por tempo." : "Finalizada."} Tempo total respondendo: {formatClock(totalTime)}.</p>
      </header>

      {dailyToday && <DailyDone streak={dailyToday.streak} shields={dailyToday.shields} correct={dailyToday.correct ?? t.correct} total={dailyToday.total} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-sm text-muted-foreground">Acertos</p><p className="text-3xl font-extrabold">{t.correct}<span className="text-lg text-muted-foreground">/{t.total}</span></p><p className="text-sm font-semibold text-primary">{t.pct}%</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Erros</p><p className="text-3xl font-extrabold text-danger">{t.wrong}</p><p className="text-sm text-muted-foreground">{t.blank} em branco</p></Card>
        {enem?.average != null ? (
          <Card className="p-5"><p className="text-sm text-muted-foreground">Nota estimada (média)</p><p className="text-3xl font-extrabold">{enem.average}</p><p className="text-xs text-muted-foreground">{enem.official ? "TRI com parâmetros oficiais" : "aproximação, não é TRI"}</p></Card>
        ) : ufpr ? (
          <Card className="p-5"><p className="text-sm text-muted-foreground">Nota UFPR (objetiva)</p><p className="text-3xl font-extrabold">{ufpr.score.toLocaleString("pt-BR")}</p><p className="text-xs text-muted-foreground">escala 0–1000, sem pesos de curso</p></Card>
        ) : (
          <Card className="p-5"><p className="text-sm text-muted-foreground">Tempo médio</p><p className="text-3xl font-extrabold">{t.total ? formatClock(totalTime / Math.max(rows.length, 1)) : "—"}</p><p className="text-xs text-muted-foreground">por questão</p></Card>
        )}
      </div>

      {enem && (
        <p className="flex gap-2 rounded-control bg-primary-soft p-3 text-sm text-primary-soft-foreground"><Info className="mt-0.5 size-4 shrink-0" aria-hidden /> {enem.official ? TRI_OFFICIAL_NOTICE : TRI_NOTICE}</p>
      )}

      {wrongOrBlank > 0 && (
        <Card className="flex flex-col gap-3 p-5 md:flex-row md:items-center">
          <div className="flex-1">
            <p className="font-bold">{t.wrong > 0 ? `${t.wrong} erros foram para o caderno de erros` : "Refaça as que ficaram em branco"}</p>
            <p className="text-sm text-muted-foreground">Elas voltam para revisão em 1, 3, 7, 14 e 30 dias.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <RetryButton attemptId={id} count={wrongOrBlank} />
            <Button asChild variant="outline"><Link href="/estudar/erros"><RotateCcw aria-hidden /> Caderno de erros</Link></Button>
            <Button asChild variant="ghost"><Link href={`/estudar/exportar?tentativa=${id}`}><Download aria-hidden /> Baixar em PDF/EPUB</Link></Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {byArea.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Por área</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {byArea.map((b) => (
                <div key={b.key} className="grid gap-1">
                  <div className="flex justify-between text-sm font-semibold"><span>{AREA_UI[b.key as keyof typeof AREA_UI]?.label ?? b.key}</span><span>{b.correct}/{b.total} · {b.pct}%{enem?.areas[b.key as Area] ? ` · ~${enem.areas[b.key as Area]}` : ""}</span></div>
                  <Progress value={b.pct} label={`Acertos em ${b.key}`} barClassName={AREA_BAR[b.key]} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {bySubject.length > 1 || (bySubject.length === 1 && bySubject[0].key !== "Sem classificação") ? (
          <Card>
            <CardHeader><CardTitle>Por disciplina</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {bySubject.map((b) => (
                <div key={b.key} className="grid gap-1">
                  <div className="flex justify-between text-sm font-semibold"><span>{b.key}</span><span>{b.correct}/{b.total} · {b.pct}%</span></div>
                  <Progress value={b.pct} label={`Acertos em ${b.key}`} />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
        {byTopic.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Por assunto</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {byTopic.slice(0, 15).map((b) => (
                <div key={b.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{b.key}</span>
                  <Badge tone={b.pct >= 70 ? "success" : b.pct >= 40 ? "warning" : "danger"}>{b.correct}/{b.total}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        <Card className={byTopic.length ? "" : "lg:col-span-2"}>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="size-4" aria-hidden /> Tempo por questão</CardTitle></CardHeader>
          <CardContent><TimeChart data={chart} /></CardContent>
        </Card>
      </div>

      {discursive.length > 0 && (
        <section aria-labelledby="disc" className="flex flex-col gap-3">
          <h2 id="disc" className="text-lg font-bold">Respostas discursivas</h2>
          {discursive.map(({ question: q }) => (
            <Card key={q.id} className="grid gap-3 p-5">
              <Markdown className="text-base">{q.statement_md}</Markdown>
              <div className="rounded-control bg-muted p-3"><p className="mb-1 text-xs font-bold uppercase text-muted-foreground">Sua resposta</p><p className="whitespace-pre-line">{ans.get(q.id)?.discursive_text || "(em branco)"}</p></div>
              {keyOf.get(q.id)?.official_mirror_md && (
                <div className="rounded-control bg-primary-soft p-3 text-primary-soft-foreground"><p className="mb-1 text-xs font-bold uppercase">Espelho oficial</p><Markdown className="text-base">{keyOf.get(q.id)!.official_mirror_md!}</Markdown></div>
              )}
            </Card>
          ))}
          <DiscursiveAi attemptId={id} questionIds={discursive.map((d) => d.question.id)} aiReady={aiConfigured()} />
        </section>
      )}

      <section aria-labelledby="gab" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="gab" className="text-lg font-bold">Gabarito comentado</h2>
          <nav aria-label="Filtrar questões" className="flex gap-1 rounded-full border border-border bg-muted p-1 text-sm font-semibold">
            {[["todas", "Todas"], ["erradas", "Erradas"], ["branco", "Em branco"]].map(([v, l]) => (
              <Link key={v} href={`?filtro=${v}`} scroll={false} aria-current={filtro === v ? "page" : undefined}
                className={`flex min-h-10 items-center rounded-full px-3 ${filtro === v ? "bg-card shadow-sm" : "text-muted-foreground"}`}>{l}</Link>
            ))}
          </nav>
        </div>
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma questão neste filtro. 🎉</p>}
        <ul className="grid gap-2">
          {filtered.map(({ question: q, position }) => {
            const r = rows[list.findIndex((x) => x.question.id === q.id)];
            const k = keyOf.get(q.id);
            const ok = q.kind === "objective" && r.choice && r.choice === r.correct;
            return (
              <li key={q.id}>
                <details className="group rounded-card border border-border bg-card">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 p-4">
                    <span className="font-bold">{position + 1}</span>
                    {areaBadge(q.area)}
                    {q.kind === "objective" ? (
                      <Badge tone={ok ? "success" : r.choice ? "danger" : "neutral"}>{ok ? "Acertou" : r.choice ? `Marcou ${r.choice} · certa ${r.correct ?? "—"}` : `Em branco · certa ${r.correct ?? "—"}`}</Badge>
                    ) : <Badge tone="primary">Discursiva</Badge>}
                    <span className="ml-auto text-xs text-muted-foreground">{formatClock(r.time_spent_ms)}</span>
                  </summary>
                  <div className="border-t border-border p-4">
                    <QuestionView statement={q.statement_md} alternatives={[...q.alternatives].sort((a, b) => a.label.localeCompare(b.label))} correct={k?.correct_label} explanation={k?.explanation_md} mirror={k?.official_mirror_md} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
