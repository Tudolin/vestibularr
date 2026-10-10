"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
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
        <Switch checked={on} onCheckedChange={() => toggle()} disabled={pending} label="Alunos só veem questões com resolução" />
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
