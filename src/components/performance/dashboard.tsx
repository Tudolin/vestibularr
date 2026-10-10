import { BookCheck, Clock, Flame, Info, PenLine, Target, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { AREAS as AREA_UI } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { bankFacets } from "@/lib/attempts/queries";
import { computeMastery, rankTopics, type TopicMastery } from "@/lib/mastery";
import { getBands, getFacts, getStats, pct, type Stats } from "@/lib/performance";
import { sisuCourseEstimate, ufprCourseEstimate } from "@/lib/scoring/courses";
import { estimateEnem, TRI_NOTICE, TRI_OFFICIAL_NOTICE, type Area, type SisuWeights } from "@/lib/scoring/enem";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { AccuracyChart } from "@/components/charts-lazy";
import { CoursesCard, type CourseOption, type CourseResult } from "./courses-card";
import { GoalsCard } from "./goals-card";
import { NewAchievements } from "./new-achievements";
import { TopicHeatmap } from "./topic-heatmap";

const AREA_BAR: Record<string, string> = { linguagens: "bg-area-linguagens", humanas: "bg-area-humanas", natureza: "bg-area-natureza", matematica: "bg-area-matematica" };

/** Painel de desempenho de um aluno. `userId` null = o próprio usuário logado. */
export async function PerformanceDashboard({ userId, board, editable }: { userId: string | null; board: "ENEM" | "UFPR" | null; editable: boolean }) {
  const supabase = await createClient();
  const [stats, enemStats, ufprStats, bands, enemFacts, facets] = await Promise.all([
    getStats(userId, board),
    board === "UFPR" ? null : getStats(userId, "ENEM"),
    board === "ENEM" ? null : getStats(userId, "UFPR"),
    getBands(),
    board === "UFPR" ? [] : getFacts(userId, "ENEM"),
    bankFacets(),
  ]);
  const uid = stats.user_id;
  const [{ data: earned }, { data: profile }, { data: courseRows }] = await Promise.all([
    supabase.from("achievements").select("code, earned_at").eq("user_id", uid),
    supabase.from("profiles").select("target_courses").eq("id", uid).maybeSingle(),
    supabase.from("courses").select("id, institution, via, name, campus, degree, shift, ufpr_specific, sisu_weights, course_cutoffs(year, modality, cutoff)").eq("is_active", true).order("institution").order("campus").order("name"),
  ]);

  const t = stats.totals;
  const linear = enemStats ? estimateEnem(Object.fromEntries(enemStats.by_area.map((a) => [a.key, { correct: a.correct, total: a.answered }])) as Record<Area, { correct: number; total: number }>, bands) : null;
  // TRI com os parâmetros oficiais quando a área tem questões com parâmetros; senão, a aproximação linear
  const mastery = computeMastery(enemFacts);
  const tri: Partial<Record<Area, number>> = Object.fromEntries(mastery.areas.filter((a) => a.official > 0).map((a) => [a.area, a.score]));
  const enem = linear ? (() => {
    const areas = { ...linear.areas, ...tri };
    const vals = Object.values(areas);
    return { areas, average: vals.length ? Math.round(vals.reduce((x, y) => x + y, 0) / vals.length) : null, official: Object.keys(tri).length > 0 };
  })() : null;
  const weights = facets.topics.filter((t) => t.board === "ENEM" && t.subject).map((t) => ({ subject: t.subject as string, topic: t.name, n: t.n }));
  const ranked = rankTopics(mastery.topics, weights);
  // sem assuntos com TRI (ex.: só UFPR): ranking por % de acerto, como antes
  const topics = stats.by_topic.filter((x) => x.answered >= 5).map((x) => ({ ...x, p: pct(x.correct, x.answered) }));
  const strong = [...topics].sort((a, b) => b.p - a.p || b.answered - a.answered).slice(0, 5);
  const weak = [...topics].sort((a, b) => a.p - b.p || b.answered - a.answered).slice(0, 5);
  const weekMinutes = stats.week.minutes;

  // cursos-alvo
  type CourseRow = { id: string; institution: string; via: "ufpr" | "sisu"; name: string; campus: string | null; degree: string | null; shift: string | null; ufpr_specific: { subject: string; weight: number }[]; sisu_weights: SisuWeights | null; course_cutoffs: { year: number; modality: string; cutoff: number }[] };
  const rows = (courseRows ?? []) as CourseRow[];
  const label = (c: CourseRow) => `${c.institution} · ${c.name}${c.campus ? ` (${c.campus}` : ""}${c.shift ? `, ${c.shift}` : ""}${c.campus ? ")" : ""}`;
  const options: CourseOption[] = rows.map((c) => ({ id: c.id, label: label(c), via: c.via }));
  const targets = (profile?.target_courses as string[] | undefined) ?? [];
  const results: CourseResult[] = targets.map((id) => rows.find((r) => r.id === id)).filter((c): c is CourseRow => !!c).map((c) => {
    const cut = [...c.course_cutoffs].sort((a, b) => b.year - a.year || (a.modality === "ampla" ? -1 : 1))[0] ?? null;
    const cutoff = cut ? { value: Number(cut.cutoff), year: cut.year, modality: cut.modality } : null;
    if (c.via === "ufpr") {
      const est = ufprStats ? ufprCourseEstimate(ufprStats.by_subject, c.ufpr_specific, stats.essays.ufpr?.avg_pct ?? null) : null;
      const notes: string[] = [];
      if (!est) notes.push("Faça questões da UFPR para estimar.");
      else {
        if (c.ufpr_specific.length) notes.push(`Peso ${est.weight.toLocaleString("pt-BR")} em ${c.ufpr_specific.map((s) => s.subject).join(" e ")} (Anexo XX).`);
        if (est.filledWithAverage.length) notes.push(`Sem dados em ${est.filledWithAverage.length} disciplinas: usada sua média geral.`);
        if (est.cptMissing) notes.push("Sem produção textual UFPR corrigida: CPT contada como 0.");
      }
      return { id: c.id, label: label(c), via: "ufpr", score: est?.score ?? null, scale: "0–1000, estimativa", cutoff, notes };
    }
    const w = c.sisu_weights ?? { linguagens: 1, humanas: 1, natureza: 1, matematica: 1, redacao: 1 };
    const est = sisuCourseEstimate(enemStats?.by_area ?? [], stats.essays.enem?.avg_total ?? null, w, bands, tri);
    const notes = est.missing.length ? [`Falta estimar: ${est.missing.join(", ")}.`] : [Object.keys(tri).length ? "Notas por área estimadas pela TRI (parâmetros oficiais do INEP)." : "Notas por área são aproximação linear (não é TRI)."];
    if (!c.sisu_weights) notes.push("Pesos do curso não cadastrados: usado peso 1 em tudo.");
    return { id: c.id, label: label(c), via: "sisu", score: est.score, scale: "média ponderada ENEM", cutoff, notes };
  });

  if (t.answered === 0 && stats.essays.enem?.count === 0 && !stats.essays.ufpr?.count) {
    return (
      <div className="flex flex-col gap-6">
        <EmptyState icon={<Target aria-hidden />} title="Ainda sem dados" description="Faça um treino ou simulado: seu desempenho aparece aqui por área, assunto e ao longo do tempo." />
        <GoalsCard goals={stats.goals} progress={{ questions_day: stats.week.answered_today, questions_week: stats.week.answered, minutes_week: weekMinutes, essays_week: stats.week.essays }} editable={editable} />
        <CoursesCard results={results} options={options} selected={targets} editable={editable} />
      </div>
    );
  }

  const earnedSet = new Set((earned ?? []).map((e) => e.code));
  return (
    <div className="flex flex-col gap-6">
      {editable && <NewAchievements />}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<BookCheck aria-hidden />} label="Questões" value={t.answered.toLocaleString("pt-BR")} sub={`${pct(t.correct, t.answered)}% de acerto`} />
        <Kpi icon={<Flame aria-hidden />} label="Sequência" value={`${stats.streak.current} ${stats.streak.current === 1 ? "dia" : "dias"}`} sub={`melhor: ${stats.streak.best}${stats.streak.studied_today ? " · hoje ✓" : " · estude hoje!"}`} />
        <Kpi icon={<Clock aria-hidden />} label="Estudo na semana" value={`${Math.floor(weekMinutes / 60)}h${String(weekMinutes % 60).padStart(2, "0")}`} sub={`${stats.week.answered} questões`} />
        <Kpi icon={<PenLine aria-hidden />} label="Redações" value={String((stats.essays.enem?.count ?? 0) + (stats.essays.ufpr?.count ?? 0))} sub={stats.essays.enem?.avg_total ? `média ENEM ${stats.essays.enem.avg_total}` : "corrigidas (últimas)"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Evolução (8 semanas)</CardTitle></CardHeader>
          <CardContent><AccuracyChart daily={stats.daily} /></CardContent>
        </Card>
        <GoalsCard goals={stats.goals} progress={{ questions_day: stats.week.answered_today, questions_week: stats.week.answered, minutes_week: weekMinutes, essays_week: stats.week.essays }} editable={editable} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {stats.by_area.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Por área{enem && board !== "UFPR" ? " e nota estimada (ENEM)" : ""}</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {stats.by_area.map((b) => (
                <div key={`${b.board}-${b.key}`} className="grid gap-1">
                  <div className="flex justify-between text-sm font-semibold">
                    <span>{AREA_UI[b.key as keyof typeof AREA_UI]?.label ?? b.key}{!board && <span className="ml-1 text-xs font-normal text-muted-foreground">({b.board})</span>}</span>
                    <span>{pct(b.correct, b.answered)}% · {b.answered}q{b.board === "ENEM" && enem?.areas[b.key as Area] ? ` · ~${enem.areas[b.key as Area]}` : ""}</span>
                  </div>
                  <Progress value={pct(b.correct, b.answered)} label={`Acerto em ${b.key}`} barClassName={AREA_BAR[b.key]} />
                </div>
              ))}
              {enem?.average != null && board !== "UFPR" && (
                <p className="flex gap-2 rounded-control bg-primary-soft p-3 text-xs text-primary-soft-foreground"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> <span>Média estimada ENEM: <strong>{enem.average}</strong>. {enem.official ? TRI_OFFICIAL_NOTICE : TRI_NOTICE}</span></p>
              )}
            </CardContent>
          </Card>
        )}
        <CoursesCard results={results} options={options} selected={targets} editable={editable} />
      </div>

      {ranked.focus.length + ranked.strengths.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <MasteryList title="Pontos fortes" icon={<TrendingUp className="size-4 text-success" aria-hidden />} items={ranked.strengths} tone="success"
            empty="Continue praticando: os assuntos em que você vai bem aparecem aqui." />
          <MasteryList title="Onde focar" icon={<Target className="size-4 text-danger" aria-hidden />} items={ranked.focus} tone="danger"
            hint="Assuntos que mais caem no ENEM e em que você mais erra: é onde cada hora de estudo rende mais pontos."
            empty="Nenhum assunto fraco por enquanto. Faça mais questões para afinar." />
        </div>
      ) : topics.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <TopicList title="Pontos fortes" icon={<TrendingUp className="size-4 text-success" aria-hidden />} items={strong} tone="success" />
          <TopicList title="Pontos fracos" icon={<TrendingDown className="size-4 text-danger" aria-hidden />} items={weak} tone="danger" />
        </div>
      )}

      {stats.by_topic.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Mapa de calor por assunto</CardTitle></CardHeader>
          <CardContent><TopicHeatmap topics={stats.by_topic.slice(0, 60)} /></CardContent>
        </Card>
      )}

      {stats.essays.enem?.avg_scores && (
        <Card>
          <CardHeader><CardTitle>Redação ENEM — média das últimas correções</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-5">
            {["c1", "c2", "c3", "c4", "c5"].map((k) => (
              <div key={k} className="grid gap-1 rounded-control border border-border p-3 text-center">
                <span className="text-xs font-bold uppercase text-muted-foreground">{k}</span>
                <span className="text-xl font-extrabold">{stats.essays.enem.avg_scores?.[k] ?? "—"}</span>
                <Progress value={((stats.essays.enem.avg_scores?.[k] ?? 0) / 200) * 100} label={`Competência ${k}`} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="size-4" aria-hidden /> Conquistas ({earnedSet.size}/{ACHIEVEMENTS.length})</CardTitle></CardHeader>
        <CardContent>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {ACHIEVEMENTS.map((a) => {
              const on = earnedSet.has(a.code);
              return (
                <li key={a.code} className={cn("flex items-center gap-3 rounded-control border p-3", on ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-dashed border-border text-muted-foreground")}>
                  <span className={cn("text-2xl", !on && "grayscale opacity-50")} aria-hidden>{a.emoji}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{a.title}{!on && <span className="sr-only"> (bloqueada)</span>}</span>
                    <span className="block text-xs">{a.desc}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground [&_svg]:size-4">{icon} {label}</span>
      <span className="text-2xl font-extrabold">{value}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </Card>
  );
}

function MasteryList({ title, icon, items, tone, hint, empty }: { title: string; icon: React.ReactNode; items: (TopicMastery & { weight?: number })[]; tone: "success" | "danger"; hint?: string; empty: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2">{icon} {title}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {items.map((t) => (
            // quebra a linha em telas estreitas ou com fonte grande, em vez de alargar a página
            <li key={`${t.subject}-${t.topic}`} className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
              <span className="min-w-0 max-w-full truncate">{t.topic}<span className="ml-1 text-xs text-muted-foreground">{t.subject}</span></span>
              <span className={cn("font-bold", tone === "success" ? "text-success" : "text-danger")}>
                ~{t.score} <span className="text-xs font-normal text-muted-foreground">({t.correct}/{t.n}{t.weight != null ? ` · ${Math.round(t.weight * 1000) / 10}% da prova` : ""})</span>
              </span>
            </li>
          ))}
        </ul>
        {hint && items.length > 0 && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function TopicList({ title, icon, items, tone }: { title: string; icon: React.ReactNode; items: { key: string; subject?: string; answered: number; p: number }[]; tone: "success" | "danger" }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2">{icon} {title}</CardTitle></CardHeader>
      <CardContent>
        <ul className="grid gap-2">
          {items.map((t) => (
            <li key={t.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{t.key}<span className="ml-1 text-xs text-muted-foreground">{t.subject}</span></span>
              <span className={cn("font-bold", tone === "success" ? "text-success" : "text-danger")}>{t.p}% <span className="text-xs font-normal text-muted-foreground">({t.answered})</span></span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export type { Stats };
