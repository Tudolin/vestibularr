import { Flame, Inbox, Sparkles, Users, Wind } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, handle } from "@/components/social/avatar";
import { CreateCrew, JoinCrew } from "@/components/social/crew-forms";
import { Feed } from "@/components/social/feed";
import { FriendRow, FriendSearch, IncomingRequest, ShareInvite } from "@/components/social/friends";
import { League } from "@/components/social/league";
import { ProfileSetup } from "@/components/social/profile-setup";
import { EditProfileButton } from "@/components/social/edit-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { levelInfo, nowMs, TIERS, type FeedEvent, type Overview } from "@/lib/social";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tripulação" };

const TABS = [["amigos", "Amigos"], ["liga", "Liga"], ["tripulacoes", "Tripulações"]] as const;

export default async function TripulacaoPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba = "amigos" } = await searchParams;
  const supabase = await createClient();
  const [{ data: ov }, { data: feed }] = await Promise.all([supabase.rpc("social_overview"), supabase.rpc("friends_feed")]);
  const o = ov as Overview;
  const me = o.me;

  if (!me.username) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold md:text-3xl">Monte sua tripulação ⚓</h1>
          <p className="text-muted-foreground">Estude com amigos: ranking da semana, ligas com divisões, boosts e um mural para comemorar as conquistas. Primeiro, escolha como vão te chamar.</p>
        </header>
        <Card><CardContent className="pt-6"><ProfileSetup /></CardContent></Card>
      </div>
    );
  }

  const lv = levelInfo(me.total_xp);
  const boostLeft = me.boost_until ? Math.max(0, Math.round((new Date(me.boost_until).getTime() - nowMs()) / 60000)) : 0;
  const tab = TABS.some(([t]) => t === aba) ? aba : "amigos";

  return (
    <div className="flex flex-col gap-6">
      {/* cartão do jogador */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 bg-gradient-to-br from-primary to-[var(--area-linguagens)] p-5 text-primary-foreground">
          <Avatar card={me} size="lg" className="ring-4 ring-white/40" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-extrabold">{handle(me)}</p>
            <p className="text-sm opacity-90">Nível {lv.level} · {me.total_xp.toLocaleString("pt-BR")} XP no total</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-label="Progresso até o próximo nível" aria-valuenow={Math.round(lv.pct)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${lv.pct}%` }} />
            </div>
            <p className="mt-1 text-xs opacity-80">{lv.need - lv.into} XP para o nível {lv.level + 1}</p>
          </div>
          <EditProfileButton username={me.username} emoji={me.avatar.emoji} color={me.avatar.color} />
        </div>
        <CardContent className="grid grid-cols-3 divide-x divide-border p-0 text-center">
          <Stat label="XP na semana" value={me.week_xp.toLocaleString("pt-BR")} icon={<Sparkles className="size-4 text-primary" aria-hidden />} />
          <Stat label="Sequência" value={`${me.streak} ${me.streak === 1 ? "dia" : "dias"}`} icon={<Flame className="size-4 text-[var(--area-humanas)]" aria-hidden />} />
          <Stat label="Divisão" value={o.league ? TIERS[o.league.tier].name : "—"} icon={<span aria-hidden>{o.league ? TIERS[o.league.tier].emoji : "🪵"}</span>} />
        </CardContent>
      </Card>

      {boostLeft > 0 && (
        <p className="flex items-center gap-2 rounded-card bg-success-soft p-3 text-sm font-semibold text-success-soft-foreground">
          <Wind className="size-4" aria-hidden /> Vento a favor ativo: +50% de XP por mais {boostLeft} min. Aproveite!
        </p>
      )}
      {o.boosts.filter((b) => b.kind === "empurrao").slice(0, 3).map((b) => (
        <p key={b.id} className="flex items-center gap-2 rounded-card border border-border bg-card p-3 text-sm">
          <Avatar card={b.from} size="sm" /> <span><strong>{handle(b.from)}</strong>: {b.message}</span>
        </p>
      ))}

      <nav aria-label="Seções da tripulação" className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1 text-sm font-bold">
        {TABS.map(([t, l]) => (
          <Link key={t} href={`/tripulacao?aba=${t}`} scroll={false} aria-current={tab === t ? "page" : undefined}
            className={cn("flex min-h-11 items-center justify-center rounded-full transition-colors", tab === t ? "bg-card shadow-sm" : "text-muted-foreground")}>
            {l}{t === "amigos" && o.incoming.length > 0 && <span className="ml-1.5 inline-flex size-5 items-center justify-center rounded-full bg-danger text-[11px] text-white">{o.incoming.length}</span>}
          </Link>
        ))}
      </nav>

      {tab === "amigos" && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="size-4" aria-hidden /> Ranking da semana</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <FriendSearch />
                  <ShareInvite path={`/amigo/${me.username}`} text={`Bora estudar juntos no Vestibularr? Me adiciona: @${me.username}`} />
                </div>
                {o.incoming.length > 0 && (
                  <section aria-label="Pedidos de amizade" className="grid gap-2">
                    <h2 className="flex items-center gap-1.5 text-sm font-bold"><Inbox className="size-4" aria-hidden /> Pedidos</h2>
                    <ul className="grid gap-2">{o.incoming.map((c) => <IncomingRequest key={c.id} card={c} />)}</ul>
                  </section>
                )}
                {o.friends.length <= 1 ? (
                  <p className="rounded-card border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    Adicione amigos pelo @apelido ou mande seu link. O ranking da semana zera toda segunda.
                  </p>
                ) : (
                  <ol className="stagger grid grid-cols-[minmax(0,1fr)] gap-1">
                    {o.friends.map((c, i) => (
                      <FriendRow key={c.id} card={c} rank={i + 1} isMe={c.id === me.id} ventoUsed={o.sent_today.vento} nudged={o.sent_today.empurrao.includes(c.id)} />
                    ))}
                  </ol>
                )}
                {o.outgoing.length > 0 && <p className="text-xs text-muted-foreground">Aguardando: {o.outgoing.map((c) => handle(c)).join(", ")}</p>}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Mural</CardTitle></CardHeader>
            <CardContent><Feed events={(feed ?? []) as FeedEvent[]} now={nowMs()} /></CardContent>
          </Card>
        </div>
      )}

      {tab === "liga" && <League league={o.league} meId={me.id} weekEnd={o.week_end} />}

      {tab === "tripulacoes" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Suas tripulações</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {o.crews.length === 0 && <p className="text-sm text-muted-foreground">Grupo de até 12 pessoas com ranking próprio e mural. Crie uma ou entre com o código de um amigo.</p>}
              <ul className="stagger grid grid-cols-[minmax(0,1fr)] gap-2">
                {o.crews.map((c) => (
                  <li key={c.id}>
                    <Link href={`/tripulacao/${c.id}`} className="lift flex items-center gap-3 rounded-card border border-border p-3 hover:border-primary">
                      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-2xl" aria-hidden>{c.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.members} {c.members === 1 ? "pessoa" : "pessoas"}{c.role === "captain" ? " · você é o capitão" : ""}</span>
                      </span>
                      <span className="text-sm font-extrabold tabular-nums">{c.week_xp} XP</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <div className="flex flex-col gap-6">
            <Card><CardHeader><CardTitle>Criar tripulação</CardTitle></CardHeader><CardContent><CreateCrew /></CardContent></Card>
            <Card><CardHeader><CardTitle>Entrar com código</CardTitle></CardHeader><CardContent><JoinCrew /></CardContent></Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-3">
      <span className="flex items-center gap-1 text-base font-extrabold">{icon}{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
