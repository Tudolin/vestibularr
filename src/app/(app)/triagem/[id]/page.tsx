import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { areaBadge } from "@/components/question-view";
import { Markdown } from "@/components/markdown";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/server";
import type { TriagemState } from "@/lib/triagem";
import { TriagemQuestion } from "./triagem-question";

export const metadata: Metadata = { title: "Triagem" };

type Q = { id: string; area: string | null; year: number | null; statement_md: string; alternatives: { id: string; label: string; text_md: string; image_url: string | null }[] };

export default async function TriagemRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("triagem_state", { p_attempt: id });
  if (error || !data) notFound();
  const state = data as TriagemState;
  if (state.status !== "in_progress" || !state.question_id) redirect(`/triagem/${id}/relatorio`);

  const { data: q } = await supabase
    .from("questions")
    .select("id, area, year, statement_md, alternatives(id, label, text_md, image_url)")
    .eq("id", state.question_id)
    .single<Q>();
  if (!q) notFound();
  const alternatives = [...q.alternatives].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-extrabold">Triagem · questão {state.answered + 1} de {state.total}</h1>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">{areaBadge(q.area)}{q.year ? `ENEM ${q.year}` : null}</span>
        </div>
        <Progress value={(state.answered / state.total) * 100} label="Progresso da triagem" />
      </header>
      {/* key: troca de questão = componente novo (zera escolha e cronômetro) */}
      <TriagemQuestion
        key={q.id}
        attemptId={id}
        questionId={q.id}
        statement={<Markdown>{q.statement_md}</Markdown>}
        alternatives={alternatives.map((a) => ({
          label: a.label,
          content: (
            <>
              {a.text_md && <Markdown className="text-base">{a.text_md}</Markdown>}
              {a.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.image_url} alt={`Alternativa ${a.label}`} loading="lazy" className="mt-2 max-h-56 rounded-control bg-white" />
              )}
            </>
          ),
        }))}
      />
    </div>
  );
}
