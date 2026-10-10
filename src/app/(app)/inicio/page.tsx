import { redirect } from "next/navigation";
import { ClipboardList, Compass, Flame, Play, RotateCcw, Target } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { DEFAULT_GOALS } from "@/lib/achievements";
import { dueErrorsCount, listOpenAttempts } from "@/lib/attempts/queries";
import { getStats } from "@/lib/performance";
import { listTriagens } from "@/lib/triagem";
import { Avatar } from "@/components/social/avatar";
import { TIERS, type Overview } from "@/lib/social";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Início" };

export default async function InicioPage() {
  const user = await requireUser();
  // conta nova (cadastro público) passa primeiro pelo onboarding
  if (user.role === "student" && user.preferences.onboarded !== true) redirect("/onboarding");
  const supabase = await createClient();
  const [open, errors, stats, triagens, { data: ov }] = await Promise.all([listOpenAttempts(1), dueErrorsCount(), getStats(null, null), listTriagens(), supabase.rpc("social_overview")]);
  const social = ov as Overview | null;
  const nudge = social?.boosts.find((b) => b.kind === "empurrao"); // a RPC já traz só os dos últimos 3 dias
  const leaguePos = social?.league ? social.league.members.findIndex((m) => m.id === social.me.id) + 1 : 0;
  const triagemOpen = triagens.find((t) => t.status === "in_progress");
  const triagemDone = triagens.some((t) => t.status === "finished");
  const dayGoal = stats.goals.questions_day ?? DEFAULT_GOALS.questions_day;
  const today = stats.week.answered_today;
  const last = open[0];
  const first = user.fullName.split(" ")[0] || "estudante";
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold md:text-3xl">Olá, {first}! 👋</h1>
        <p className="text-muted-foreground">Vamos estudar um pouco hoje?</p>
      </header>

      {!triagemDone && (
        <Card className="flex flex-col gap-4 border-primary bg-primary-soft p-5 text-primary-soft-foreground sm:flex-row sm:items-center">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Compass aria-hidden /></span>
          <div className="flex-1">
            <p className="font-bold">{triagemOpen ? "Termine sua triagem" : "Descubra seu nível"}</p>
            <p className="text-sm">
              {triagemOpen
                ? "Continue de onde parou para ver sua nota por área e onde focar."
                : "Cerca de 30 questões que se ajustam a você. No fim: nota estimada por área e os assuntos onde focar."}
            </p>
          </div>
          <Button asChild className="self-start sm:self-center"><Link href={triagemOpen ? `/triagem/${triagemOpen.id}` : "/triagem"}>{triagemOpen ? "Continuar" : "Fazer a triagem"}</Link></Button>
        </Card>
      )}

      {social && (
        <Link href="/tripulacao" className="lift flex flex-wrap items-center gap-4 rounded-card border border-border bg-card p-4 hover:border-primary">
          <Avatar card={social.me} />
          <div className="min-w-0 flex-1">
            <p className="font-bold">{social.me.username ? "Sua tripulação" : "Monte sua tripulação ⚓"}</p>
            <p className="text-sm text-muted-foreground">
              {social.me.username
                ? `${social.me.week_xp} XP na semana · 🔥 ${social.me.streak} ${social.me.streak === 1 ? "dia" : "dias"}${social.league ? ` · ${TIERS[social.league.tier].emoji} ${leaguePos}º na liga ${TIERS[social.league.tier].name}` : ""}`
                : "Adicione amigos, dispute a liga da semana e mande boosts."}
            </p>
          </div>
          {social.incoming.length > 0 && <span className="rounded-full bg-danger px-2.5 py-1 text-xs font-bold text-white">{social.incoming.length} {social.incoming.length === 1 ? "pedido" : "pedidos"}</span>}
          {social.me.boost_until && <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success-soft-foreground">⛵ Vento a favor ativo</span>}
          {nudge && <span className="w-full text-sm">👋 <strong>@{nudge.from.username}</strong>: {nudge.message}</span>}
        </Link>
      )}

      <div className="stagger grid gap-4 md:grid-cols-2">
        <HomeCard icon={<Play />} title="Continuar de onde parei" description="Seu último simulado ou treino em andamento.">
          {last ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm"><strong>{last.title}</strong> · {last.answered} de {last.total} respondidas{last.status === "paused" ? " · pausado" : ""}</p>
              <Progress value={last.total ? (last.answered / last.total) * 100 : 0} label="Progresso" />
              <Button asChild className="self-start"><Link href={`/prova/${last.id}`}>Continuar</Link></Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">Nada em andamento.</p>
              <Button asChild variant="soft" className="self-start"><Link href="/estudar/personalizado?modo=treino">Começar um treino</Link></Button>
            </div>
          )}
        </HomeCard>
        <HomeCard icon={<Target />} title="Meta do dia" description="Questões resolvidas hoje.">
          <Progress value={(today / dayGoal) * 100} label="Meta do dia" barClassName={today >= dayGoal ? "bg-success" : undefined} />
          <p className="mt-2 text-sm text-muted-foreground">{today} de {dayGoal} questões{today >= dayGoal ? " — meta cumprida! 🎉" : ""}</p>
        </HomeCard>
        <HomeCard icon={<RotateCcw />} title="Revisão de erros" description="Questões que você errou e devem ser refeitas.">
          {errors.due > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm"><strong>{errors.due}</strong> para revisar hoje ({errors.total} pendentes no total).</p>
              <Button asChild className="self-start"><Link href="/estudar/erros">Revisar agora</Link></Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{errors.total > 0 ? `Em dia! ${errors.total} erros voltam nos próximos dias.` : "Nenhum erro pendente por enquanto."}</p>
          )}
        </HomeCard>
        <HomeCard icon={<ClipboardList />} title="Próximo simulado sugerido" description="Baseado nos seus alvos e no seu desempenho.">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Faça uma prova completa no tempo oficial.</p>
            <Button asChild variant="soft" className="self-start"><Link href="/estudar/simulados">Ver simulados</Link></Button>
          </div>
        </HomeCard>
      </div>

      <Card className="flex items-center gap-4 p-5">
        <span className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning-soft-foreground">
          <Flame aria-hidden />
        </span>
        <div>
          <p className="font-bold">Sequência: {stats.streak.current} {stats.streak.current === 1 ? "dia" : "dias"}</p>
          <p className="text-sm text-muted-foreground">
            {stats.streak.studied_today ? `Você já estudou hoje. Melhor sequência: ${stats.streak.best}.` : stats.streak.current > 0 ? "Estude hoje para não perder a sequência!" : "Estude hoje para começar sua sequência."}
          </p>
        </div>
      </Card>
    </div>
  );
}

function HomeCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground [&_svg]:size-5">{icon}</span>
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
