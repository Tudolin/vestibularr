"use client";

import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { approveImportAction, rejectImportAction } from "./actions";

export type PendingRow = { id: string; filename: string; questions: number; exams: number; by: string; at: string };

export function PendingList({ rows }: { rows: PendingRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="pend" className="flex flex-col gap-3">
      <h2 id="pend" className="text-lg font-bold">Envios de alunos aguardando revisão ({rows.length})</h2>
      <ul className="grid gap-2">
        {rows.map((r) => (
          <li key={r.id}>
            <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.filename}</p>
                <p className="text-sm text-muted-foreground">{r.questions} questões em {r.exams} provas · por {r.by} · {new Date(r.at).toLocaleDateString("pt-BR")}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={pending}
                  onClick={() => { setBusy(r.id); start(async () => {
                    const res = await approveImportAction(r.id);
                    setBusy(null);
                    if (res.ok) { toast.success(`Aprovado: ${res.inserted} novas, ${res.updated} atualizadas`); router.refresh(); } else toast.error(res.error);
                  }); }}
                >
                  {busy === r.id ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} Aprovar e importar
                </Button>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => { const note = window.prompt("Motivo (opcional):") ?? ""; start(async () => {
                    const res = await rejectImportAction(r.id, note);
                    if (res.ok) { toast.success("Envio rejeitado"); router.refresh(); } else toast.error(res.error ?? "Erro");
                  }); }}
                >
                  <X aria-hidden /> Rejeitar
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
