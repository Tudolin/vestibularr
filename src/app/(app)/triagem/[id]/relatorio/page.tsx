import { ArrowRight, Lock, Target, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AREAS as AREA_UI } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement, levelOf, triagemReport } from "@/lib/triagem";
import { cn } from "@/lib/utils";
import { startFocusTreinoAction } from "../../actions";

export const metadata: Metadata = { title: "Resultado da triagem" };

const AREA_BAR: Record<string, string> = { linguagens: "bg-area-linguagens", humanas: "bg-area-humanas", natureza: "bg-area-natureza", matematica: "bg-area-matematica" };
// escala visual das barras: 300 a 900 (faixa usual das notas do ENEM)
const pos = (v: number) => Math.min(Math.max(((v - 300) / 600) * 100, 0), 100);

export default async function TriagemReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser();
  const report = await triagemReport(id);
  if (!report) notFound();
  if (report.attempt.status === "in_progress") redirect(`/triagem/${id}`);

  const supabase = await createClient();
  const [detail, { data: profile }] = await Promise.all([
    getEntitlement("triagem_report"),
    supabase.from("profiles").select("target_courses").eq("id", user.id).maybeSingle(),
  ]);
  const full = !detail || detail.unlimited || (detail.quota ?? 0) > 0;
  const targets = (profile?.target_courses as string[] | undefined) ?? [];
  const { data: courses } = targets.length
    ? await supabase.from("courses").select("id, name, institution, via, course_cutoffs(year, modality, cutoff)").in("id", targets).eq("via", "sisu")
    : { data: [] };
  const course = (courses ?? [])
    .map((c) => ({ ...c, cut: [...c.course_cutoffs].sort((a, b) => b.year - a.year || (a.modality === "ampla" ? -1 : 1))[0] }))
    .find((c) => c.cut);

  const { areas, average, strengths, focus } = report;
  const level = average != null ? levelOf(average) : null;
  const s = report.attempt.score;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-primary">Resultado da triagem</p>
        <h1 className="text-2xl font-extrabold md:text-3xl">{level ? `Nível: ${level.name}` : "Triagem encerrada"}</h1>
        {level && <p className="text-muted-foreground">{level.desc}</p>}
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-sm text-muted-foreground">Nota estimada (média)</p><p className="text-3xl font-extrabold">{average ?? "—"}</p><p className="text-xs text-muted-foreground">TRI, parâmetros oficiais do INEP</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Acertos</p><p className="text-3xl font-extrabold">{s?.correct ?? 0}<span className="text-lg text-muted-foreground">/{s?.total ?? 0}</span></p><p className="text-xs text-muted-foreground">{s?.blank ? `${s.blank} "não sei"` : "sem chutes em branco"}</p></Card>
        {course?.cut ? (
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Corte: {course.name}</p>
            <p className="text-3xl font-extrabold">{Number(course.cut.cutoff).toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">
              {average != null && (average >= Number(course.cut.cutoff) ? "Sua média já passa do corte" : `Faltam ~${Math.round(Number(course.cut.cutoff) - average)} pontos`)} (sem redação; {course.cut.year})
            </p>
          </Card>
        ) : (
          <Card className="p-5"><p className="text-sm text-muted-foreground">Curso desejado</p><p className="text-sm">Escolha seus cursos em <Link className="font-semibold text-primary underline" href="/desempenho">Desempenho</Link> para comparar com a nota de corte.</p></Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Nota estimada por área</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {areas.map((a) => (
            <div key={a.area} className="grid gap-1.5">
              <div className="flex justify-between text-sm font-semibold">
                <span>{AREA_UI[a.area]?.label ?? a.area}</span>
                <span>~{a.score} <span className="text-xs font-normal text-muted-foreground">(entre {a.low} e {a.high} · {a.correct}/{a.n})</span></span>
              </div>
              {/* faixa de incerteza + ponto estimado */}
              <div className="relative h-3 rounded-full bg-muted" role="img" aria-label={`${AREA_UI[a.area]?.label ?? a.area}: nota estimada ${a.score}, provavelmente entre ${a.low} e ${a.high}`}>
                <div className={cn("absolute inset-y-0 rounded-full opacity-35", AREA_BAR[a.area])} style={{ left: `${pos(a.low)}%`, width: `${Math.max(pos(a.high) - pos(a.low), 2)}%` }} />
                <div className={cn("absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card", AREA_BAR[a.area])} style={{ left: `${pos(a.score)}%` }} />
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Com poucas questões por área a estimativa tem margem (a faixa clara). Ela fica mais precisa a cada treino e simulado:
            o Desempenho continua atualizando sua nota.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Target className="size-4 text-danger" aria-hidden /> Onde focar</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {(full ? focus : focus.slice(0, 3)).map((t) => (
              <div key={`${t.subject}-${t.topic}`} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{t.topic} <span className="text-xs text-muted-foreground">{t.subject}</span></span>
                {full && <span className="shrink-0 text-xs text-muted-foreground">{Math.round(t.weight * 1000) / 10}% da prova</span>}
              </div>
            ))}
            {focus.length === 0 && <p className="text-sm text-muted-foreground">Nenhum ponto fraco claro nesta triagem.</p>}
            <p className="text-xs text-muted-foreground">Assuntos que mais caem e em que você mais errou: é onde cada hora de estudo rende mais pontos.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="size-4 text-success" aria-hidden /> Pontos fortes</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {full ? (
              strengths.length ? strengths.map((t) => (
                <div key={`${t.subject}-${t.topic}`} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">{t.topic} <span className="text-xs text-muted-foreground">{t.subject}</span></span>
                  <span className="shrink-0 font-bold text-success">~{t.score}</span>
                </div>
              )) : <p className="text-sm text-muted-foreground">Continue praticando: seus pontos fortes aparecem aqui.</p>
            ) : (
              <p className="flex gap-2 text-sm text-muted-foreground"><Lock className="mt-0.5 size-4 shrink-0" aria-hidden /> O relatório completo por assunto (pontos fortes, nota por assunto e peso na prova) faz parte dos planos Estudante e Pro.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {focus.length > 0 ? (
          <form action={startFocusTreinoAction.bind(null, focus.map((t) => t.topic))}>
            <Button type="submit" size="lg" className="w-full sm:w-auto">Treinar onde focar <ArrowRight aria-hidden /></Button>
          </form>
        ) : (
          <Button asChild size="lg"><Link href="/estudar/personalizado?modo=treino">Fazer um treino <ArrowRight aria-hidden /></Link></Button>
        )}
        <Button asChild size="lg" variant="soft"><Link href={`/estudar/resultado/${id}`}>Ver as questões com resolução</Link></Button>
        <Button asChild size="lg" variant="ghost"><Link href="/inicio">Ir para o início</Link></Button>
      </div>
    </div>
  );
}
