import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { excerpt } from "@/components/markdown";
import { areaBadge } from "@/components/question-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { dueErrorsCount } from "@/lib/attempts/queries";
import { createClient } from "@/lib/supabase/server";
import { ReviewButton } from "./review-button";

export const metadata: Metadata = { title: "Caderno de erros" };

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
/** Renderização por requisição (dinâmica): comparar com o horário atual é intencional. */
const isDue = (iso: string) => new Date(iso).getTime() <= Date.now();

export default async function ErrosPage() {
  const supabase = await createClient();
  const [{ due, total }, { data: rows }] = await Promise.all([
    dueErrorsCount(),
    supabase
      .from("error_notebook")
      .select("question_id, box, next_review_at, last_result, question:questions(id, area, year, number, statement_md)")
      .is("resolved_at", null)
      .order("next_review_at")
      .limit(100),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start"><Link href="/estudar"><ArrowLeft aria-hidden /> Estudar</Link></Button>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold md:text-3xl">Caderno de erros</h1>
        <p className="text-muted-foreground">Questões que você errou voltam em 1, 3, 7, 14 e 30 dias. Acertar 5 vezes seguidas resolve o erro.</p>
      </header>

      {total === 0 ? (
        <EmptyState icon={<CheckCircle2 aria-hidden />} title="Arr! Nenhum erro pendente" description="Quando você errar questões em simulados ou treinos, elas aparecem aqui automaticamente." />
      ) : (
        <>
          <Card className="flex flex-col gap-3 p-5 md:flex-row md:items-center">
            <div className="flex-1">
              <p className="text-lg font-bold">{due > 0 ? `${due} para revisar agora` : "Nada vence hoje"}</p>
              <p className="text-sm text-muted-foreground">{total} erros pendentes no total.</p>
            </div>
            {due > 0 ? <ReviewButton count={Math.min(due, 20)} /> : <Badge tone="success">Em dia</Badge>}
          </Card>
          <ul className="grid gap-2">
            {(rows ?? []).map((r) => {
              const q = r.question as unknown as { id: string; area: string | null; year: number | null; number: number | null; statement_md: string } | null;
              const due = isDue(r.next_review_at);
              return (
                <li key={r.question_id}>
                  <Card className="flex flex-col gap-1 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {areaBadge(q?.area ?? null)}
                      {q?.year && <Badge>{q.year}</Badge>}
                      <Badge tone={due ? "warning" : "neutral"}><RotateCcw className="size-3" aria-hidden /> caixa {r.box} · {due ? "vence hoje" : fmt.format(new Date(r.next_review_at))}</Badge>
                    </div>
                    <p className="text-sm">{excerpt(q?.statement_md ?? "", 160)}</p>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
