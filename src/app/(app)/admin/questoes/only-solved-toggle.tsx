"use client";

import { useState, useTransition } from "react";
import { setOnlySolvedAction } from "./actions";

/** Interruptor: alunos só veem/sorteiam questões com resolução comentada. */
export function OnlySolvedToggle({ initial, solved, total }: { initial: boolean; solved: number; total: number }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      setError(null);
      const r = await setOnlySolvedAction(!on);
      if (r.ok) setOn(!on);
      else setError(r.error);
    });
  return (
    <div className="flex flex-col gap-1 rounded-card border border-border bg-card p-4">
      <label className="flex items-center justify-between gap-4">
        <span className="flex flex-col">
          <span className="font-semibold">Alunos só veem questões com resolução</span>
          <span className="text-sm text-muted-foreground">
            {solved} de {total} questões ativas têm resolução comentada (ou espelho, nas discursivas). Vale para banco, busca, simulados e treinos.
          </span>
        </span>
        <button
          type="button" role="switch" aria-checked={on} disabled={pending} onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-primary" : "bg-muted"}`}
        >
          <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
          <span className="sr-only">{on ? "Ligado" : "Desligado"}</span>
        </button>
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
