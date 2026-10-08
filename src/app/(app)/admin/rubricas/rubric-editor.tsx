"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { saveRubricAction } from "../temas/actions";

type Criterion = { key: string; name: string; description: string; max: number; step?: number };
export type RubricRow = { id: string; kind: "enem" | "ufpr" | "discursive"; name: string; version: number; criteria: Criterion[]; instructions: string };
const LABEL = { enem: "Redação ENEM", ufpr: "Produção textual UFPR", discursive: "Discursivas (espelho)" };

export function RubricEditor({ rubric }: { rubric: RubricRow }) {
  const [crit, setCrit] = useState<Criterion[]>(rubric.criteria);
  const [instructions, setInstructions] = useState(rubric.instructions);
  const [pending, start] = useTransition();
  const router = useRouter();
  const frac = rubric.kind !== "enem";
  const sum = crit.reduce((s, c) => s + Number(c.max || 0), 0);
  const set = (i: number, k: keyof Criterion, v: string) => setCrit((l) => l.map((c, j) => (j === i ? { ...c, [k]: k === "max" || k === "step" ? Number(v) : v } : c)));

  return (
    <Card className="grid gap-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">{LABEL[rubric.kind]}</h2>
        <Badge>versão {rubric.version}</Badge>
        {frac && <Badge tone={Math.abs(sum - 1) < 0.001 ? "success" : "danger"}>soma dos pesos: {(sum * 100).toFixed(1)}%</Badge>}
      </div>
      {crit.map((c, i) => (
        <div key={i} className="grid gap-2 rounded-control border border-border p-3 md:grid-cols-[8rem_1fr_7rem_auto]">
          <div className="grid gap-1"><Label htmlFor={`k-${rubric.id}-${i}`}>Chave</Label><Input id={`k-${rubric.id}-${i}`} value={c.key} onChange={(e) => set(i, "key", e.target.value)} /></div>
          <div className="grid gap-1"><Label htmlFor={`n-${rubric.id}-${i}`}>Nome</Label><Input id={`n-${rubric.id}-${i}`} value={c.name} onChange={(e) => set(i, "name", e.target.value)} /></div>
          <div className="grid gap-1"><Label htmlFor={`m-${rubric.id}-${i}`}>{frac ? "Peso (0–1)" : "Máximo"}</Label><Input id={`m-${rubric.id}-${i}`} type="number" step={frac ? "0.01" : "1"} value={c.max} onChange={(e) => set(i, "max", e.target.value)} /></div>
          <Button variant="ghost" size="icon" className="self-end" aria-label={`Remover ${c.name}`} onClick={() => setCrit((l) => l.filter((_, j) => j !== i))}><Trash2 /></Button>
          <div className="grid gap-1 md:col-span-4"><Label htmlFor={`d-${rubric.id}-${i}`}>Descrição (vai para a IA)</Label>
            <textarea id={`d-${rubric.id}-${i}`} className="min-h-16 rounded-control border border-input bg-card p-2 text-base md:text-sm" value={c.description} onChange={(e) => set(i, "description", e.target.value)} /></div>
        </div>
      ))}
      <Button variant="outline" className="justify-self-start" onClick={() => setCrit((l) => [...l, { key: `crit${l.length + 1}`, name: "Novo critério", description: "Descreva o que avaliar.", max: frac ? 0 : 200, step: frac ? undefined : 40 }])}><Plus aria-hidden /> Critério</Button>
      <div className="grid gap-1"><Label htmlFor={`i-${rubric.id}`}>Regras gerais (zeramento, observações)</Label>
        <textarea id={`i-${rubric.id}`} className="min-h-20 rounded-control border border-input bg-card p-3 text-base md:text-sm" value={instructions} onChange={(e) => setInstructions(e.target.value)} /></div>
      <Button className="justify-self-start" disabled={pending} onClick={() => start(async () => {
        const r = await saveRubricAction({ kind: rubric.kind, name: rubric.name, instructions, criteria: crit });
        if (r.ok) { toast.success("Nova versão da rubrica ativa"); router.refresh(); } else toast.error(r.error);
      })}>{pending && <Loader2 className="animate-spin" aria-hidden />} Salvar nova versão</Button>
    </Card>
  );
}
