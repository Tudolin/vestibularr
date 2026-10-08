import { Check } from "lucide-react";
import { AREAS, Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";

type Alt = { id: string; label: string; text_md: string; image_url: string | null };

export function areaBadge(area: string | null) {
  if (!area || !(area in AREAS)) return null;
  const a = AREAS[area as keyof typeof AREAS];
  return <Badge tone={a.tone}>{a.label}</Badge>;
}

/** Questão completa, só leitura. `correct` só é passado para admin (Fase 3 libera ao aluno após responder). */
export function QuestionView({
  statement,
  alternatives,
  correct,
  explanation,
  mirror,
}: {
  statement: string;
  alternatives: Alt[];
  correct?: string | null;
  explanation?: string | null;
  mirror?: string | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Markdown>{statement}</Markdown>
      {alternatives.length > 0 && (
        <ol className="grid gap-2" aria-label="Alternativas">
          {alternatives.map((a) => {
            const isCorrect = correct === a.label;
            return (
              <li
                key={a.id}
                className={cn(
                  "flex min-h-14 items-start gap-3 rounded-card border px-4 py-3",
                  isCorrect ? "border-success bg-success-soft text-success-soft-foreground" : "border-border bg-card",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground">{a.label}</span>
                <div className="min-w-0 flex-1">
                  {a.text_md && <Markdown className="text-base">{a.text_md}</Markdown>}
                  {a.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image_url} alt={`Alternativa ${a.label}`} loading="lazy" className="mt-2 max-h-56 rounded-control bg-white" />
                  )}
                </div>
                {isCorrect && <Check className="mt-1 size-5 shrink-0" aria-label="Alternativa correta" />}
              </li>
            );
          })}
        </ol>
      )}
      {explanation && (
        <section className="rounded-card bg-primary-soft p-4 text-primary-soft-foreground">
          <h3 className="mb-1 font-bold">Resolução</h3>
          <Markdown className="text-base">{explanation}</Markdown>
        </section>
      )}
      {mirror && (
        <section className="rounded-card bg-primary-soft p-4 text-primary-soft-foreground">
          <h3 className="mb-1 font-bold">Espelho oficial</h3>
          <Markdown className="text-base">{mirror}</Markdown>
        </section>
      )}
    </div>
  );
}
