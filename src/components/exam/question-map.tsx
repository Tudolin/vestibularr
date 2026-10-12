"use client";

import { Check, Flag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionStatus } from "@/lib/attempt/reducer";

/**
 * Mapa clicável. Cor E ícone/forma (nunca só cor): respondida ✓, em branco ○, revisão ⚑.
 * No treino (`results`), a respondida mostra se acertou (verde ✓) ou errou (vermelho ✕).
 */
export function QuestionMap({ statuses, current, onGo, results }: { statuses: QuestionStatus[]; current: number; onGo: (i: number) => void; results?: (boolean | null)[] }) {
  const graded = !!results?.some((r) => r !== null);
  return (
    <div>
      <ol className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-5" aria-label="Mapa de questões">
        {statuses.map((s, i) => {
          const r = s === "answered" ? results?.[i] ?? null : null;
          return (
          <li key={i}>
            <button
              type="button"
              onClick={() => onGo(i)}
              aria-label={`Questão ${i + 1}: ${r === true ? "acertou" : r === false ? "errou" : s === "answered" ? "respondida" : s === "flagged" ? "marcada para revisão" : "em branco"}`}
              aria-current={i === current ? "true" : undefined}
              className={cn(
                "relative flex size-11 w-full items-center justify-center rounded-control border-2 text-sm font-bold",
                s === "answered" && r === null && "border-primary bg-primary text-primary-foreground",
                r === true && "border-success bg-success-soft text-success-soft-foreground",
                r === false && "border-danger bg-danger-soft text-danger-soft-foreground",
                s === "blank" && "border-input bg-card text-foreground",
                s === "flagged" && "border-[var(--area-humanas)] bg-warning-soft text-warning-soft-foreground",
                i === current && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
              )}
            >
              {i + 1}
              {s === "answered" && r !== false && <Check className="absolute -right-1 -top-1 size-4 rounded-full bg-success p-0.5 text-white dark:text-black" aria-hidden />}
              {r === false && <X className="absolute -right-1 -top-1 size-4 rounded-full bg-danger p-0.5 text-white dark:text-black" aria-hidden />}
              {s === "flagged" && <Flag className="absolute -right-1 -top-1 size-4 rounded-full bg-warning-soft p-0.5" aria-hidden />}
            </button>
          </li>
          );
        })}
      </ol>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
        {graded ? (
          <>
            <li className="flex items-center gap-1"><Check className="size-3 rounded-full bg-success p-px text-white dark:text-black" aria-hidden /> Acertou</li>
            <li className="flex items-center gap-1"><X className="size-3 rounded-full bg-danger p-px text-white dark:text-black" aria-hidden /> Errou</li>
          </>
        ) : (
          <li className="flex items-center gap-1"><span className="size-3 rounded-sm bg-primary" aria-hidden /> Respondida</li>
        )}
        <li className="flex items-center gap-1"><span className="size-3 rounded-sm border-2 border-input" aria-hidden /> Em branco</li>
        <li className="flex items-center gap-1"><Flag className="size-3" aria-hidden /> Revisão</li>
      </ul>
    </div>
  );
}
