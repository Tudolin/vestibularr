import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/lib/auth";
import { FEEDBACK_KINDS, FEEDBACK_PAGES, FEEDBACK_STATUS, RATING_FACES, type FeedbackKind } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { FeedbackAdminItem } from "./feedback-admin-item";

export const metadata: Metadata = { title: "Feedbacks" };

type Row = {
  id: string; kind: FeedbackKind; rating: number | null; message: string; page: string | null; device: string | null;
  status: string; reply: string | null; created_at: string; profile: { full_name: string | null; email: string | null } | null;
};

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Navegador e sistema, legíveis (o user-agent completo fica no title). */
function deviceLabel(ua: string | null) {
  if (!ua) return null;
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return [br, os].filter(Boolean).join(" · ") || "outro";
}

export default async function AdminFeedbacksPage({ searchParams }: { searchParams: Promise<{ tipo?: string; status?: string }> }) {
  await requireAdmin();
  const { tipo, status } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("feedback")
    .select("id, kind, rating, message, page, device, status, reply, created_at, profile:profiles(full_name, email)")
    .order("created_at", { ascending: false }).limit(1000);
  const all = (data ?? []) as unknown as Row[];
  const list = all.filter((f) => (!tipo || f.kind === tipo) && (!status || f.status === status));
  const ratings = all.filter((f) => f.rating).map((f) => f.rating as number);
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const href = (p: { tipo?: string; status?: string }) => {
    const q = new URLSearchParams(Object.entries({ tipo, status, ...p }).filter(([, v]) => v) as [string, string][]);
    return `/admin/feedbacks${q.size ? `?${q}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold md:text-3xl">Feedbacks</h1>
        <p className="text-muted-foreground">Tudo o que os alunos mandam pela tela Feedback. Responda para o aluno ver a resposta no app.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Novos" value={all.filter((f) => f.status === "novo").length} />
        {FEEDBACK_KINDS.map((k) => <Kpi key={k.key} label={`${k.emoji} ${k.label}`} value={all.filter((f) => f.kind === k.key).length} />)}
        <Kpi label="Experiência" value={avg ? `${RATING_FACES[Math.round(avg) - 1]} ${avg.toFixed(1)}` : "—"} sub={`${ratings.length} ${ratings.length === 1 ? "nota" : "notas"}`} />
      </div>

      <nav aria-label="Filtros" className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Filter href={href({ tipo: "" })} on={!tipo}>Todos os tipos</Filter>
          {FEEDBACK_KINDS.map((k) => <Filter key={k.key} href={href({ tipo: k.key })} on={tipo === k.key}>{k.emoji} {k.label}</Filter>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Filter href={href({ status: "" })} on={!status}>Qualquer status</Filter>
          {Object.entries(FEEDBACK_STATUS).map(([s, v]) => <Filter key={s} href={href({ status: s })} on={status === s}>{s === "novo" ? "Novos" : v.label}</Filter>)}
        </div>
      </nav>

      {list.length === 0 ? (
        <EmptyState title="Nenhum feedback aqui" description={all.length ? "Mude os filtros para ver os outros." : "Quando os alunos mandarem, aparece aqui."} />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((f) => {
            const k = FEEDBACK_KINDS.find((x) => x.key === f.kind);
            const st = FEEDBACK_STATUS[f.status] ?? FEEDBACK_STATUS.novo;
            return (
              <li key={f.id}>
                <Card className={cn("flex flex-col gap-3 p-4", f.status === "novo" && "border-primary/50")}>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-bold">{k?.emoji} {k?.label}</span>
                    {f.rating && <span aria-label={`Nota ${f.rating} de 5`}>{RATING_FACES[f.rating - 1]}</span>}
                    <span className="text-muted-foreground">{f.profile?.full_name ?? "Aluno"}{f.profile?.email ? ` · ${f.profile.email}` : ""}</span>
                    <Badge tone={st.tone} className="ml-auto">{st.label}</Badge>
                  </div>
                  <p className="whitespace-pre-wrap">{f.message}</p>
                  <p className="text-xs text-muted-foreground" title={f.device ?? undefined}>
                    {fmt(f.created_at)}{f.page ? ` · ${FEEDBACK_PAGES.find(([p]) => p === f.page)?.[1] ?? f.page}` : ""}{f.device ? ` · ${deviceLabel(f.device)}` : ""}
                  </p>
                  <FeedbackAdminItem id={f.id} status={f.status} reply={f.reply} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <Card className="flex flex-col gap-0.5 p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-extrabold tabular-nums">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </Card>
  );
}

function Filter({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={on ? "page" : undefined}
      className={cn("flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold", on ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-input bg-card hover:bg-muted")}>
      {children}
    </Link>
  );
}
