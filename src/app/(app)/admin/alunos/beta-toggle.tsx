"use client";

import { useState, useTransition } from "react";
import { setBetaAction } from "./actions";

/** Interruptor do beta: todos os alunos com acesso Pro enquanto não há pagamento. */
export function BetaToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = () => start(async () => {
    setError(null);
    const r = await setBetaAction(!on);
    if (r.ok) setOn(!on); else setError(r.error);
  });
  return (
    <div className="flex flex-col gap-1 rounded-card border border-border bg-card p-4">
      <label className="flex items-center justify-between gap-4">
        <span className="flex flex-col">
          <span className="font-semibold">Beta: tudo liberado</span>
          <span className="text-sm text-muted-foreground">
            Enquanto não há pagamento, todos os alunos usam o plano Pro (a cota diária de IA continua valendo). Desligue quando a assinatura entrar.
          </span>
        </span>
        <button type="button" role="switch" aria-checked={on} disabled={pending} onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors after:absolute after:-inset-2 after:content-[""] disabled:opacity-60 ${on ? "bg-primary" : "bg-muted"}`}>
          <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
          <span className="sr-only">{on ? "Ligado" : "Desligado"}</span>
        </button>
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
