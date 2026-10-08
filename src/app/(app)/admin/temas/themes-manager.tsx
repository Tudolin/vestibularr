"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FieldError, Input, Label } from "@/components/ui/input";
import { deleteThemeAction, saveThemeAction } from "./actions";

export type ThemeRow = {
  id: string; kind: "enem" | "ufpr"; title: string; prompt_md: string; support_texts_md: string | null; task_type: string; genre: string | null;
  line_limit: number; min_lines: number; max_score: number; official_mirror_md: string | null; year: number | null; source: string; is_published: boolean;
};
const TASKS = [["dissertativo", "Dissertativo-argumentativo"], ["resumo", "Resumo"], ["expositivo", "Expositivo"], ["argumentativo", "Argumentativo"], ["analise_dados", "Análise de dados/gráfico"], ["continuidade", "Continuidade textual"], ["genero", "Gênero específico"]];
const ta = "min-h-24 w-full rounded-control border border-input bg-card p-3 text-base md:text-sm";
const sel = "h-11 w-full rounded-control border border-input bg-card px-3 text-base md:text-sm";

export function ThemesManager({ rows }: { rows: ThemeRow[] }) {
  const [edit, setEdit] = useState<ThemeRow | "new" | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Temas e propostas</h1>
          <p className="text-sm text-muted-foreground">Temas oficiais do ENEM já vêm cadastrados (só o título). Cole os textos motivadores se quiser.</p>
        </div>
        <Button onClick={() => setEdit("new")}><Plus aria-hidden /> Novo</Button>
      </header>
      <ul className="grid gap-2">
        {rows.map((t) => (
          <li key={t.id}>
            <Card className="flex flex-col gap-2 p-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t.title}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge tone="primary">{t.kind.toUpperCase()}</Badge>
                  {t.year && <Badge>{t.year}</Badge>}
                  <Badge>{t.line_limit} linhas · {t.max_score} pts</Badge>
                  {!t.is_published && <Badge tone="warning">oculto</Badge>}
                  {t.official_mirror_md && <Badge tone="success">com espelho</Badge>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" aria-label={`Editar ${t.title}`} onClick={() => setEdit(t)}><Pencil /></Button>
                <Button variant="outline" size="icon" aria-label={`Excluir ${t.title}`} disabled={pending} onClick={() => {
                  if (!window.confirm("Excluir este tema?")) return;
                  start(async () => { const r = await deleteThemeAction(t.id); if (r.ok) router.refresh(); else toast.error(r.error); });
                }}><Trash2 /></Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="md:max-w-2xl">{edit && <ThemeForm row={edit === "new" ? null : edit} onDone={() => { setEdit(null); router.refresh(); }} />}</DialogContent>
      </Dialog>
    </div>
  );
}

function ThemeForm({ row, onDone }: { row: ThemeRow | null; onDone: () => void }) {
  const [kind, setKind] = useState<"enem" | "ufpr">(row?.kind ?? "ufpr");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="grid gap-3" onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      start(async () => {
        const r = await saveThemeAction({ ...f, id: row?.id, kind, is_published: f.is_published === "on" });
        if (r.ok) { toast.success("Tema salvo"); onDone(); } else setErr(r.fieldErrors ? Object.entries(r.fieldErrors).map(([k, v]) => `${k}: ${v?.[0]}`).join(" · ") : r.error);
      });
    }}>
      <DialogTitle>{row ? "Editar tema" : "Novo tema"}</DialogTitle>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1"><Label htmlFor="kind">Vestibular</Label>
          <select id="kind" className={sel} value={kind} onChange={(e) => setKind(e.target.value as "enem" | "ufpr")}><option value="enem">ENEM</option><option value="ufpr">UFPR</option></select></div>
        <div className="grid gap-1"><Label htmlFor="task_type">Tipo de tarefa</Label>
          <select id="task_type" name="task_type" className={sel} defaultValue={row?.task_type ?? (kind === "enem" ? "dissertativo" : "resumo")}>{TASKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      </div>
      <div className="grid gap-1"><Label htmlFor="title">Título / tema</Label><Input id="title" name="title" defaultValue={row?.title} required /></div>
      <div className="grid gap-1"><Label htmlFor="prompt_md">Comando / proposta (markdown)</Label><textarea id="prompt_md" name="prompt_md" className={ta} defaultValue={row?.prompt_md} required /></div>
      <div className="grid gap-1"><Label htmlFor="support_texts_md">Textos de apoio (markdown; tabelas e imagens por link)</Label><textarea id="support_texts_md" name="support_texts_md" className={ta} defaultValue={row?.support_texts_md ?? ""} /></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="grid gap-1"><Label htmlFor="line_limit">Linhas (máx.)</Label><Input id="line_limit" name="line_limit" type="number" defaultValue={row?.line_limit ?? (kind === "enem" ? 30 : 15)} /></div>
        <div className="grid gap-1"><Label htmlFor="min_lines">Linhas (mín.)</Label><Input id="min_lines" name="min_lines" type="number" defaultValue={row?.min_lines ?? (kind === "enem" ? 8 : 0)} /></div>
        <div className="grid gap-1"><Label htmlFor="max_score">Nota máx.</Label><Input id="max_score" name="max_score" type="number" step="0.01" defaultValue={row?.max_score ?? (kind === "enem" ? 1000 : 25)} /></div>
        <div className="grid gap-1"><Label htmlFor="year">Ano</Label><Input id="year" name="year" type="number" defaultValue={row?.year ?? ""} /></div>
      </div>
      {kind === "ufpr" && <div className="grid gap-1"><Label htmlFor="genre">Gênero (carta, e-mail, artigo…)</Label><Input id="genre" name="genre" defaultValue={row?.genre ?? ""} /></div>}
      <div className="grid gap-1"><Label htmlFor="official_mirror_md">Espelho oficial (opcional — a IA usa como referência)</Label><textarea id="official_mirror_md" name="official_mirror_md" className={ta} defaultValue={row?.official_mirror_md ?? ""} /></div>
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="is_published" defaultChecked={row?.is_published ?? true} className="size-5" /> Visível para os alunos</label>
      <FieldError>{err ?? undefined}</FieldError>
      <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} Salvar</Button>
    </form>
  );
}
