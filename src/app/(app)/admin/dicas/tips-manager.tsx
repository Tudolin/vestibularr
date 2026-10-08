"use client";

import { Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { deleteTipAction, saveTipAction } from "./actions";

export type TipRow = { id: string; slug: string; title: string; summary: string; category: string; body_md: string; sort: number; is_published: boolean };

export function TipsManager({ rows }: { rows: TipRow[] }) {
  const [edit, setEdit] = useState<TipRow | "new" | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold md:text-3xl">Dicas</h1><p className="text-sm text-muted-foreground">Páginas em markdown: tabelas, listas, links e imagens por URL.</p></div>
        <Button onClick={() => setEdit("new")}><Plus aria-hidden /> Nova dica</Button>
      </header>
      <ul className="grid gap-2">
        {rows.map((t) => (
          <li key={t.id}>
            <Card className="flex flex-col gap-2 p-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t.title}</p>
                <div className="mt-1 flex flex-wrap gap-2"><Badge>{t.category}</Badge><Badge>/dicas/{t.slug}</Badge>{!t.is_published && <Badge tone="warning">oculta</Badge>}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" aria-label={`Editar ${t.title}`} onClick={() => setEdit(t)}><Pencil /></Button>
                <Button variant="outline" size="icon" aria-label={`Excluir ${t.title}`} disabled={pending} onClick={() => {
                  if (!window.confirm("Excluir esta dica?")) return;
                  start(async () => { await deleteTipAction(t.id); router.refresh(); });
                }}><Trash2 /></Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="md:max-w-4xl">{edit && <TipForm row={edit === "new" ? null : edit} onDone={() => { setEdit(null); router.refresh(); }} />}</DialogContent>
      </Dialog>
    </div>
  );
}

function TipForm({ row, onDone }: { row: TipRow | null; onDone: () => void }) {
  const [body, setBody] = useState(row?.body_md ?? "## Título\n\nTexto da dica.");
  const [preview, setPreview] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-3" onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      start(async () => {
        const r = await saveTipAction({ ...f, id: row?.id, body_md: body, is_published: f.is_published === "on" });
        if (r.ok) { toast.success("Dica salva"); onDone(); } else toast.error(r.error);
      });
    }}>
      <DialogTitle>{row ? "Editar dica" : "Nova dica"}</DialogTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1"><Label htmlFor="title">Título</Label><Input id="title" name="title" defaultValue={row?.title} required /></div>
        <div className="grid gap-1"><Label htmlFor="slug">Endereço (/dicas/…)</Label><Input id="slug" name="slug" defaultValue={row?.slug} required pattern="[a-z0-9-]{2,60}" /></div>
        <div className="grid gap-1"><Label htmlFor="category">Categoria</Label><Input id="category" name="category" defaultValue={row?.category ?? "Redação ENEM"} required /></div>
        <div className="grid gap-1"><Label htmlFor="sort">Ordem</Label><Input id="sort" name="sort" type="number" defaultValue={row?.sort ?? 100} /></div>
      </div>
      <div className="grid gap-1"><Label htmlFor="summary">Resumo</Label><Input id="summary" name="summary" defaultValue={row?.summary} /></div>
      <div className="flex items-center justify-between">
        <Label htmlFor="body">Conteúdo (markdown)</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}><Eye aria-hidden /> {preview ? "Editar" : "Prévia"}</Button>
      </div>
      {preview ? (
        <Card className="max-h-[50dvh] overflow-y-auto p-4"><Markdown className="[&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold">{body}</Markdown></Card>
      ) : (
        <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[50dvh] w-full rounded-control border border-input bg-card p-3 font-mono text-sm" />
      )}
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="is_published" defaultChecked={row?.is_published ?? true} className="size-5" /> Publicada</label>
      <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} Salvar</Button>
    </form>
  );
}
