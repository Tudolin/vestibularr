"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Demographics } from "@/lib/demographics";
import { saveDemographicsAction } from "@/lib/demographics-actions";
import { AboutYouFields } from "./about-you-fields";

/** Perfil → Sobre você: editar ou apagar as respostas opcionais. */
export function AboutYouCard({ initial }: { initial: Demographics }) {
  const [v, setV] = useState<Demographics>(initial);
  const [pending, start] = useTransition();
  const save = (next: Demographics, msg: string) => start(async () => {
    const r = await saveDemographicsAction(next);
    if (!r.ok) return void toast.error(r.error);
    setV(next);
    toast.success(msg);
  });
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">Tudo opcional e só para números gerais (quem estuda com a gente). Ninguém mais vê suas respostas.</p>
      <AboutYouFields value={v} onChange={setV} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => save(v, "Respostas salvas.")}>Salvar</Button>
        <Button variant="ghost" disabled={pending} onClick={() => save({}, "Respostas apagadas.")}>Apagar minhas respostas</Button>
      </div>
    </div>
  );
}
