"use client";

import { BookMarked, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError, Input, Label } from "@/components/ui/input";
import { deleteWorkAction, saveWorkAction } from "./actions";

export type WorkRow = { id: string; title: string; author: string | null; year_from: number | null; year_to: number | null; notes: string | null };

export function WorksManager({ rows }: { rows: WorkRow[] }) {
  const [edit, setEdit] = useState<WorkRow | "new" | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function remove(w: WorkRow) {
    if (!window.confirm(`Excluir "${w.title}"? As questões continuam, só perdem o vínculo com a obra.`)) return;
    start(async () => {
      const r = await deleteWorkAction(w.id);
      if (r.ok) { toast.success("Obra excluída"); router.refresh(); } else toast.error(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Obras literárias UFPR</h1>
          <p className="text-sm text-muted-foreground">Informe o intervalo de anos em que cada obra vale. Os alunos veem esta lista em Estudar.</p>
        </div>
        <Button onClick={() => setEdit("new")}><Plus aria-hidden /> Nova obra</Button>
      </header>
      {rows.length === 0 ? (
        <EmptyState icon={<BookMarked aria-hidden />} title="Nenhuma obra cadastrada" description="Cadastre a lista do ano a partir do programa de provas do NC/UFPR." action={<Button onClick={() => setEdit("new")}><Plus aria-hidden /> Cadastrar obra</Button>} />
      ) : (
        <ul className="grid gap-2">
          {rows.map((w) => (
            <li key={w.id}>
              <Card className="flex flex-col gap-2 p-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{w.title}</p>
                  <p className="text-sm text-muted-foreground">{w.author}</p>
                  {(w.year_from || w.year_to) && <Badge className="mt-1">{w.year_from ?? "…"}–{w.year_to ?? "…"}</Badge>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" aria-label={`Editar ${w.title}`} onClick={() => setEdit(w)}><Pencil /></Button>
                  <Button variant="outline" size="icon" aria-label={`Excluir ${w.title}`} disabled={pending} onClick={() => remove(w)}><Trash2 /></Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>{edit && <WorkForm row={edit === "new" ? null : edit} onDone={() => { setEdit(null); router.refresh(); }} />}</DialogContent>
      </Dialog>
    </div>
  );
}

function WorkForm({ row, onDone }: { row: WorkRow | null; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ error: string; fields?: Record<string, string[] | undefined> } | null>(null);
  return (
    <form className="grid gap-4" onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget));
      start(async () => {
        const r = await saveWorkAction({ id: row?.id, ...f });
        if (r.ok) { toast.success("Obra salva"); onDone(); } else setRes({ error: r.error, fields: r.fieldErrors });
      });
    }}>
      <DialogTitle>{row ? "Editar obra" : "Nova obra"}</DialogTitle>
      <DialogDescription>Deixe os anos em branco se a obra não tiver prazo definido.</DialogDescription>
      <F name="title" label="Título" def={row?.title} err={res?.fields?.title} required />
      <F name="author" label="Autor(a)" def={row?.author ?? ""} err={res?.fields?.author} />
      <div className="grid grid-cols-2 gap-3">
        <F name="year_from" label="Vale a partir de" def={row?.year_from ?? ""} err={res?.fields?.year_from} type="number" />
        <F name="year_to" label="Vale até" def={row?.year_to ?? ""} err={res?.fields?.year_to} type="number" />
      </div>
      <F name="notes" label="Observações" def={row?.notes ?? ""} err={res?.fields?.notes} />
      <FieldError>{!res?.fields ? res?.error : undefined}</FieldError>
      <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} Salvar</Button>
    </form>
  );
}

function F({ name, label, def, err, ...p }: { name: string; label: string; def?: string | number; err?: string[] } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={def} aria-invalid={!!err} {...p} />
      <FieldError>{err?.[0]}</FieldError>
    </div>
  );
}
