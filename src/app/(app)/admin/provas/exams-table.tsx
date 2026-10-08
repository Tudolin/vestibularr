"use client";

import { FileText, Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError, Input, Label } from "@/components/ui/input";
import { updateExamAction } from "./actions";

export type ExamRow = { id: string; name: string; year: number; board: string; format: string | null; count: number; pdf_url: string | null; answer_pdf_url: string | null; is_published: boolean };

export function ExamsTable({ rows }: { rows: ExamRow[] }) {
  const [edit, setEdit] = useState<ExamRow | null>(null);
  const router = useRouter();
  if (rows.length === 0) return <EmptyState icon={<FileText aria-hidden />} title="Nenhuma prova ainda" description="Importe um arquivo ou rode o seed do ENEM." />;
  return (
    <>
      <ul className="grid gap-2">
        {rows.map((r) => (
          <li key={r.id}>
            <Card className="flex flex-col gap-2 p-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.name}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge>{r.board}</Badge><Badge>{r.count} questões</Badge>
                  <Badge tone={r.is_published ? "success" : "warning"}>{r.is_published ? "Publicada" : "Oculta"}</Badge>
                  <Badge tone={r.pdf_url ? "primary" : "neutral"}>{r.pdf_url ? "PDF ok" : "sem PDF"}</Badge>
                  {!r.format && <Badge tone="warning">sem formato</Badge>}
                </div>
              </div>
              <Button variant="outline" onClick={() => setEdit(r)}><Pencil aria-hidden /> Editar links</Button>
            </Card>
          </li>
        ))}
      </ul>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>{edit && <EditExam row={edit} onDone={() => { setEdit(null); router.refresh(); }} />}</DialogContent>
      </Dialog>
    </>
  );
}

function EditExam({ row, onDone }: { row: ExamRow; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="grid gap-4" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      start(async () => {
        const r = await updateExamAction({ id: row.id, pdf_url: f.get("pdf_url"), answer_pdf_url: f.get("answer_pdf_url"), is_published: f.get("is_published") === "on" });
        if (r.ok) { toast.success("Prova atualizada"); onDone(); } else setErr(r.error);
      });
    }}>
      <DialogTitle>{row.name}</DialogTitle>
      <DialogDescription>Cole o link do PDF original (ex.: site do INEP ou do NC/UFPR).</DialogDescription>
      <div className="grid gap-1.5"><Label htmlFor="pdf_url">PDF da prova</Label><Input id="pdf_url" name="pdf_url" type="url" defaultValue={row.pdf_url ?? ""} placeholder="https://" /></div>
      <div className="grid gap-1.5"><Label htmlFor="answer_pdf_url">PDF do gabarito</Label><Input id="answer_pdf_url" name="answer_pdf_url" type="url" defaultValue={row.answer_pdf_url ?? ""} placeholder="https://" /></div>
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="is_published" defaultChecked={row.is_published} className="size-5" /> Publicada (visível para os alunos)</label>
      <FieldError>{err ?? undefined}</FieldError>
      <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} Salvar</Button>
    </form>
  );
}
