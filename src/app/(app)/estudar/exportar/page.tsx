import { BookOpen, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { bankFacets, dueErrorsCount } from "@/lib/attempts/queries";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DeleteExport } from "./delete-export";
import { ExportForm } from "./export-form";

export const metadata: Metadata = { title: "Baixar PDF ou EPUB" };

type Ent = { quota: number | null; used: number; unlimited: boolean; remaining: number | null };

export default async function ExportarPage({ searchParams }: { searchParams: Promise<{ tentativa?: string }> }) {
  await requireUser();
  const { tentativa } = await searchParams;
  const supabase = await createClient();
  const [facets, errors, ent, size, attempts, past] = await Promise.all([
    bankFacets(),
    dueErrorsCount(),
    supabase.rpc("entitlement", { p_feature: "export" }).then((r) => r.data as Ent | null),
    supabase.rpc("entitlement", { p_feature: "export_size" }).then((r) => r.data as Ent | null),
    supabase.from("exam_attempts").select("id, title, updated_at").in("status", ["finished", "expired"]).neq("mode", "triagem").order("updated_at", { ascending: false }).limit(15),
    supabase.from("exports").select("id, title, created_at, question_ids, with_answers").order("created_at", { ascending: false }).limit(20),
  ]);
  const maxSize = size?.unlimited ? 200 : Math.min(size?.quota ?? 20, 200);
  const blocked = !!ent && !ent.unlimited && (ent.remaining ?? 0) <= 0;
  const fmt = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  const atts = (attempts.data ?? []).map((a) => ({ id: a.id, title: a.title, when: fmt(a.updated_at) }));
  const initialAttempt = tentativa && atts.some((a) => a.id === tentativa) ? tentativa : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold md:text-3xl">Baixar PDF ou EPUB</h1>
        <p className="mt-1 text-muted-foreground">Monte uma lista de questões para imprimir, resolver no papel ou ler no Kindle — com gabarito e resoluções.</p>
      </div>

      {ent && (
        <p className="text-sm">
          {ent.unlimited ? <Badge tone="success">Exportações ilimitadas no seu plano</Badge>
            : <Badge tone={blocked ? "warning" : "primary"}>{ent.remaining} de {ent.quota} listas novas este mês</Badge>}
          <span className="ml-2 text-muted-foreground">Baixar de novo uma lista pronta não conta.</span>
        </p>
      )}

      {blocked ? (
        <Card className="p-5 text-sm">
          Você já montou todas as listas do mês no seu plano. As listas abaixo continuam disponíveis para baixar.
          <Button asChild variant="soft" className="mt-3 w-full sm:w-auto"><Link href="/perfil#plano">Ver planos</Link></Button>
        </Card>
      ) : (
        <ExportForm facets={facets} maxSize={maxSize} attempts={atts} errorsCount={errors.total} initialAttempt={initialAttempt} />
      )}

      {(past.data ?? []).length > 0 && (
        <section aria-labelledby="minhas" className="grid gap-3">
          <h2 id="minhas" className="text-lg font-bold">Minhas listas</h2>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {(past.data ?? []).map((e) => (
              <li key={e.id}>
                <Card className="flex flex-wrap items-center gap-2 p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{e.title}</span>
                    <span className="block text-xs text-muted-foreground">{e.question_ids.length} questões · {fmt(e.created_at)}{e.with_answers ? " · com gabarito" : ""}</span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <Button asChild size="sm" variant="soft"><Link href={`/imprimir/${e.id}`}><FileText aria-hidden /> PDF</Link></Button>
                    <Button asChild size="sm" variant="outline"><a href={`/api/exportar/${e.id}/epub`} download><BookOpen aria-hidden /> EPUB</a></Button>
                    <DeleteExport id={e.id} />
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
