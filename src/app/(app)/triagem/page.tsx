import { Compass, History, Sparkles, Timer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement, listTriagens } from "@/lib/triagem";
import { skipTriagemAction, startTriagemAction } from "./actions";

export const metadata: Metadata = { title: "Triagem" };

const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });

export default async function TriagemPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const user = await requireUser();
  const { erro } = await searchParams;
  const supabase = await createClient();
  const [history, ent, { data: available }] = await Promise.all([listTriagens(), getEntitlement("triagem"), supabase.rpc("_triagem_available")]);
  const open = history.find((h) => h.status === "in_progress");
  const done = history.filter((h) => h.status === "finished");
  const ready = available !== false;
  const canStart = !!open || (ready && (!ent || ent.unlimited || (ent.remaining ?? 0) > 0));
  const first = done.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold md:text-3xl">{first ? "Descubra seu nível" : "Triagem de conhecimentos"}</h1>
        <p className="text-muted-foreground">
          Cerca de 30 questões reais do ENEM, que se ajustam a você: acertou, vem uma mais difícil; errou, uma mais fácil.
          No fim, você recebe a nota estimada por área e os assuntos onde vale mais a pena focar.
        </p>
      </header>

      {erro === "limite" && (
        <p role="alert" className="rounded-control bg-warning-soft p-3 text-sm text-warning-soft-foreground">
          Você já usou a triagem deste mês no seu plano. A próxima libera {ent?.resets_at ? `em ${fmt(ent.resets_at)}` : "no mês que vem"}.
        </p>
      )}
      {(erro === "indisponivel" || (!ready && !open)) && (
        <p role="alert" className="rounded-control bg-warning-soft p-3 text-sm text-warning-soft-foreground">
          A triagem ainda não está disponível: o banco de questões precisa dos dados da TRI.
          {user.role === "admin" ? " Rode npm run seed:taxonomia (README → Banco de questões)." : " Avise o administrador."}
        </p>
      )}
      {erro === "falha" && <p role="alert" className="rounded-control bg-danger-soft p-3 text-sm text-danger-soft-foreground">Não foi possível começar agora. Tente de novo.</p>}

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <Fact icon={<Timer />} title="~20 minutos" text="Sem cronômetro. Pode parar e continuar depois." />
          <Fact icon={<Compass />} title="Adaptativa" text="Usa a TRI com os parâmetros oficiais do INEP." />
          <Fact icon={<Sparkles />} title="Sem chute" text={'Não sabe? Toque em "Não sei": vale mais que chutar.'} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        {canStart ? (
          <form action={startTriagemAction}>
            <Button type="submit" size="lg" className="w-full sm:w-auto">{open ? "Continuar a triagem" : first ? "Começar a triagem" : "Refazer a triagem"}</Button>
          </form>
        ) : (
          <Button size="lg" disabled>{ready ? "Triagem do mês já usada" : "Triagem indisponível"}</Button>
        )}
        {first && user.role === "student" && (
          <form action={skipTriagemAction}>
            <Button type="submit" size="lg" variant="ghost" className="w-full sm:w-auto">Pular, faço depois</Button>
          </form>
        )}
      </div>
      {ent && !ent.unlimited && ent.quota != null && (
        <p className="text-xs text-muted-foreground">Seu plano inclui {ent.quota} triagem{ent.quota > 1 ? "s" : ""} por mês ({ent.remaining ?? 0} disponível{(ent.remaining ?? 0) === 1 ? "" : "is"}).</p>
      )}

      {done.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><History className="size-4" aria-hidden /> Suas triagens</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {done.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{fmt(h.finished_at ?? h.started_at)} · {h.score?.correct ?? 0}/{h.score?.total ?? 0} acertos</span>
                  <Button asChild size="sm" variant="soft"><Link href={`/triagem/${h.id}/relatorio`}>Ver relatório</Link></Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Fact({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground [&_svg]:size-5" aria-hidden>{icon}</span>
      <p className="font-bold">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
