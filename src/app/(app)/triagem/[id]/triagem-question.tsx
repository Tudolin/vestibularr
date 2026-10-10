"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { answerTriagemAction, finishTriagemAction } from "../actions";
import { needsInternet } from "@/lib/use-online";

type Alt = { label: string; content: React.ReactNode };

/** Uma questão da triagem: escolher, "Não sei" ou encerrar. Sem gabarito aqui: o resultado sai no relatório. */
export function TriagemQuestion({ attemptId, questionId, statement, alternatives }: { attemptId: string; questionId: string; statement: React.ReactNode; alternatives: Alt[] }) {
  const router = useRouter();
  const [choice, setChoice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const startedAt = useRef<number | null>(null);
  // marca o início na primeira interação (Date.now fora do render)
  const mark = () => { if (startedAt.current === null) startedAt.current = Date.now(); };

  const send = (c: string | null) => {
    setError(null);
    const ms = startedAt.current === null ? 0 : Date.now() - startedAt.current;
    if (needsInternet("A triagem (a próxima questão vem do servidor)")) return;
    start(async () => {
      const r = await answerTriagemAction(attemptId, questionId, c, ms);
      if (!r.ok) setError(r.error);
      // a página do servidor traz a próxima questão (ou manda para o relatório)
      router.refresh();
      window.scrollTo({ top: 0 });
    });
  };

  return (
    <div className="flex flex-col gap-4" onPointerDown={mark} onKeyDown={mark}>
      <Card><CardContent className="pt-6">{statement}</CardContent></Card>
      <div role="radiogroup" aria-label="Alternativas" className="grid gap-2">
        {alternatives.map((a) => (
          <button
            key={a.label}
            type="button"
            role="radio"
            aria-checked={choice === a.label}
            disabled={pending}
            onClick={() => setChoice(a.label)}
            className={cn(
              "flex min-h-14 items-start gap-3 rounded-card border px-4 py-3 text-left transition-colors",
              choice === a.label ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border bg-card hover:bg-muted",
            )}
          >
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", choice === a.label ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>{a.label}</span>
            <span className="min-w-0 flex-1">{a.content}</span>
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap gap-2 rounded-card border border-border bg-card/95 p-3 backdrop-blur md:bottom-4">
        <Button size="lg" className="flex-1" disabled={!choice || pending} onClick={() => send(choice)}>{pending ? "Salvando…" : "Responder"}</Button>
        <Button size="lg" variant="outline" disabled={pending} onClick={() => send(null)}>Não sei</Button>
        <form action={finishTriagemAction.bind(null, attemptId)} className="w-full">
          <Button type="submit" variant="ghost" size="sm" className="w-full text-muted-foreground" disabled={pending}>Encerrar agora e ver o resultado</Button>
        </form>
      </div>
    </div>
  );
}
