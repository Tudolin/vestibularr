import { ArrowLeft, Copy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Feed } from "@/components/social/feed";
import { FriendRow, ShareInvite } from "@/components/social/friends";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { nowMs, type CrewDetail, type Overview } from "@/lib/social";
import { createClient } from "@/lib/supabase/server";
import { leaveCrewAction } from "../actions";

export const metadata: Metadata = { title: "Tripulação" };

export default async function CrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data, error }, { data: ov }] = await Promise.all([supabase.rpc("crew_detail", { p_crew: id }), supabase.rpc("social_overview")]);
  if (error || !data) notFound();
  const crew = data as CrewDetail;
  const o = ov as Overview;
  const total = crew.members.reduce((s, m) => s + m.week_xp, 0);

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start"><Link href="/tripulacao?aba=tripulacoes"><ArrowLeft aria-hidden /> Tripulações</Link></Button>
      <header className="flex flex-wrap items-center gap-4">
        <span className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-4xl" aria-hidden>{crew.emoji}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold md:text-3xl">{crew.name}</h1>
          <p className="text-muted-foreground">{crew.members.length}/12 tripulantes · {total.toLocaleString("pt-BR")} XP juntos nesta semana</p>
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div>
            <p className="text-sm text-muted-foreground">Código para entrar</p>
            <p className="flex items-center gap-2 font-mono text-2xl font-extrabold tracking-widest"><Copy className="size-4 text-muted-foreground" aria-hidden />{crew.invite_code}</p>
          </div>
          <ShareInvite path={`/tripulacao/entrar/${crew.invite_code}`} label="Chamar para a tripulação" text={`Entra na minha tripulação "${crew.name}" no Vestibularr! Código: ${crew.invite_code}`} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Ranking da semana</CardTitle></CardHeader>
          <CardContent>
            <ol className="stagger grid gap-1">
              {crew.members.map((m, i) => (
                <FriendRow key={m.id} card={m} rank={i + 1} isMe={m.id === user.id} ventoUsed={o.sent_today.vento} nudged={o.sent_today.empurrao.includes(m.id)} canRemove={false} />
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Mural da tripulação</CardTitle></CardHeader>
          <CardContent><Feed events={crew.feed} now={nowMs()} /></CardContent>
        </Card>
      </div>

      <form action={leaveCrewAction.bind(null, crew.id)} className="self-start">
        <Button type="submit" variant="ghost" className="text-danger">Sair da tripulação</Button>
      </form>
    </div>
  );
}
