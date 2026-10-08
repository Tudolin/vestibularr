import { Bot, FileText, PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EvolutionChart, type EvoPoint } from "@/components/essay/evolution-chart";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { aiConfigured } from "@/lib/ai/gemini";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { StartEssayButton } from "./start-button";

export const metadata: Metadata = { title: "Redação" };

const TASK: Record<string, string> = { dissertativo: "Dissertativo-argumentativo", resumo: "Resumo", expositivo: "Texto expositivo", argumentativo: "Texto argumentativo", analise_dados: "Análise de dados", continuidade: "Continuidade textual", genero: "Gênero específico" };
const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

export default async function RedacaoPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const kind = tipo === "ufpr" ? "ufpr" : "enem";
  const supabase = await createClient();
  const [{ data: themes }, { data: essays }, { data: quota }, { data: corrections }] = await Promise.all([
    supabase.from("essay_themes").select("id, title, year, source, task_type, genre, line_limit, max_score").eq("kind", kind).order("year", { ascending: false, nullsFirst: true }).order("title"),
    supabase.from("essays").select("id, status, updated_at, theme:essay_themes(title), essay_corrections(total, max_total, status, created_at)").eq("kind", kind).order("updated_at", { ascending: false }).limit(20),
    supabase.rpc("ai_quota"),
    supabase.from("essay_corrections").select("created_at, total, max_total, scores, essay:essays!inner(kind)").eq("status", "done").eq("essay.kind", kind).order("created_at"),
  ]);
  const q = quota as { limit: number; used: number; unlimited: boolean } | null;
  const evo: EvoPoint[] = (corrections ?? []).map((c) => ({
    date: fmt.format(new Date(c.created_at)),
    pct: Math.round((Number(c.total) / Number(c.max_total)) * 100),
    ...(kind === "enem" ? (c.scores as Record<string, number>) : {}),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Redação</h1>
          <p className="text-muted-foreground">Escreva no app ou envie a foto da folha. A IA corrige com a rubrica oficial.</p>
        </div>
        {q && <Badge tone="primary"><Bot className="size-3" aria-hidden /> {q.unlimited ? "IA ilimitada (admin)" : `IA hoje: ${q.used}/${q.limit}`}</Badge>}
      </header>

      {!aiConfigured() && (
        <p className="rounded-control bg-warning-soft p-3 text-sm text-warning-soft-foreground">
          A correção por IA ainda não foi configurada. Você já pode escrever: o texto fica salvo e é corrigido quando a chave do Gemini for adicionada.
        </p>
      )}

      <nav aria-label="Tipo de prova" className="grid grid-cols-2 gap-1 rounded-full border border-border bg-muted p-1 text-sm font-bold sm:w-96">
        {[["enem", "Redação ENEM"], ["ufpr", "Produção UFPR"]].map(([v, l]) => (
          <Link key={v} href={`/redacao?tipo=${v}`} aria-current={kind === v ? "page" : undefined}
            className={cn("flex min-h-11 items-center justify-center rounded-full", kind === v ? "bg-card shadow-sm" : "text-muted-foreground")}>{l}</Link>
        ))}
      </nav>

      {(essays ?? []).length > 0 && (
        <section aria-labelledby="minhas" className="flex flex-col gap-3">
          <h2 id="minhas" className="text-lg font-bold">Minhas redações</h2>
          <ul className="grid gap-2">
            {(essays ?? []).map((e) => {
              const last = [...((e.essay_corrections as unknown as { total: number | null; max_total: number | null; status: string; created_at: string }[]) ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
              return (
                <li key={e.id}>
                  <Card className="transition-colors focus-within:border-primary hover:border-primary">
                    <Link href={`/redacao/${e.id}`} className="flex items-center gap-3 rounded-card p-4">
                      <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{(e.theme as unknown as { title: string } | null)?.title}</span>
                        <span className="block text-xs text-muted-foreground">atualizada {fmt.format(new Date(e.updated_at))}</span>
                      </span>
                      {last?.status === "done" ? <Badge tone="success">{Number(last.total).toLocaleString("pt-BR")}/{Number(last.max_total).toLocaleString("pt-BR")}</Badge>
                        : last && ["queued", "running"].includes(last.status) ? <Badge tone="primary">corrigindo</Badge>
                        : e.status === "draft" ? <Badge>rascunho</Badge> : <Badge tone="warning">enviada</Badge>}
                    </Link>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {evo.length >= 2 && (
        <Card className="p-5">
          <h2 className="mb-2 text-lg font-bold">Sua evolução</h2>
          <EvolutionChart data={evo} kind={kind} />
        </Card>
      )}

      <section aria-labelledby="temas" className="flex flex-col gap-3">
        <h2 id="temas" className="text-lg font-bold">{kind === "enem" ? "Temas" : "Propostas"}</h2>
        {(themes ?? []).length === 0 ? (
          <EmptyState icon={<PenLine aria-hidden />} title="Nenhum tema ainda" description="O administrador ainda não cadastrou propostas." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {(themes ?? []).map((t) => (
              <li key={t.id}>
                <Card className="flex h-full flex-col gap-3 p-4">
                  <div className="flex flex-wrap gap-2">
                    {t.year && <Badge>{t.year}</Badge>}
                    <Badge tone={t.source === "oficial" ? "primary" : "neutral"}>{t.source === "oficial" ? "Tema oficial" : "Proposta"}</Badge>
                    {kind === "ufpr" && <Badge tone="warning">{TASK[t.task_type]}{t.genre ? ` · ${t.genre}` : ""}</Badge>}
                    <Badge>{t.line_limit} linhas · {Number(t.max_score).toLocaleString("pt-BR")} pts</Badge>
                  </div>
                  <p className="font-bold leading-snug">{t.title}</p>
                  <div className="mt-auto"><StartEssayButton themeId={t.id} /></div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
