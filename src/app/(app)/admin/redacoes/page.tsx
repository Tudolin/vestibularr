import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

export const metadata: Metadata = { title: "Redações (admin)" };
const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default async function AdminRedacoes({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  await requireAdmin();
  const { tipo } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("essays")
    .select("id, kind, status, submitted_at, updated_at, user:profiles(full_name), theme:essay_themes(title), essay_corrections(total, max_total, status, admin_comment, created_at)")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (tipo === "enem" || tipo === "ufpr") query = query.eq("kind", tipo);
  const { data } = await query;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold md:text-3xl">Redações dos alunos</h1>
      <nav aria-label="Filtro" className="flex gap-1 self-start rounded-full border border-border bg-muted p-1 text-sm font-semibold">
        {[["", "Todas"], ["enem", "ENEM"], ["ufpr", "UFPR"]].map(([v, l]) => (
          <Link key={v} href={v ? `?tipo=${v}` : "?"} aria-current={(tipo ?? "") === v ? "page" : undefined} className={cn("flex min-h-10 items-center rounded-full px-3", (tipo ?? "") === v ? "bg-card shadow-sm" : "text-muted-foreground")}>{l}</Link>
        ))}
      </nav>
      {(data ?? []).length === 0 ? (
        <EmptyState icon={<FileText aria-hidden />} title="Nenhuma redação ainda" />
      ) : (
        <ul className="grid gap-2">
          {(data ?? []).map((e) => {
            const cs = ((e.essay_corrections as unknown as { total: number | null; max_total: number | null; status: string; admin_comment: string | null; created_at: string }[]) ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at));
            const last = cs[0];
            return (
              <li key={e.id}>
                <Card className="lift focus-within:border-primary hover:border-primary">
                  <Link href={`/admin/redacoes/${e.id}`} className="flex flex-wrap items-center gap-3 rounded-card p-4">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{(e.user as unknown as { full_name: string } | null)?.full_name}</span>
                      <span className="block truncate text-sm text-muted-foreground">{(e.theme as unknown as { title: string } | null)?.title}</span>
                    </span>
                    <Badge tone="primary">{e.kind.toUpperCase()}</Badge>
                    {last?.status === "done" ? <Badge tone="success">{Number(last.total)}/{Number(last.max_total)}</Badge> : <Badge>{e.status === "draft" ? "rascunho" : last?.status ?? "enviada"}</Badge>}
                    {last?.admin_comment ? <Badge tone="success">comentada</Badge> : last?.status === "done" ? <Badge tone="warning">sem comentário</Badge> : null}
                    <span className="text-xs text-muted-foreground">{fmt.format(new Date(e.updated_at))}</span>
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
