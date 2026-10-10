"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
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
        <Switch checked={on} onCheckedChange={() => toggle()} disabled={pending} label="Beta: tudo liberado" />
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
