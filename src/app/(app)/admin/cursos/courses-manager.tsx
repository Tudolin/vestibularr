"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { UFPR_2027_SUBJECTS } from "@/lib/scoring/ufpr";
import { deleteCourseAction, deleteCutoffAction, saveCourseAction, saveCutoffAction } from "./actions";

type Cutoff = { id: string; year: number; modality: string; cutoff: number; source: string | null };
export type CourseAdminRow = {
  id: string; institution: string; via: "ufpr" | "sisu"; name: string; campus: string | null; shift: string | null; notes: string | null;
  ufpr_specific: { subject: string; weight: number }[]; sisu_weights: Record<string, number> | null; course_cutoffs: Cutoff[];
};
const sel = "h-11 w-full rounded-control border border-input bg-card px-3 text-base md:text-sm";

export function CoursesManager({ rows }: { rows: CourseAdminRow[] }) {
  const [edit, setEdit] = useState<CourseAdminRow | "new" | null>(null);
  const [cut, setCut] = useState<CourseAdminRow | null>(null);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const list = useMemo(() => rows.filter((r) => `${r.institution} ${r.name} ${r.campus}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Cursos e notas de corte</h1>
          <p className="text-sm text-muted-foreground">Os 62 cursos UFPR com peso diferenciado vieram do Anexo XX do edital 2027. Cadastre cursos via Sisu (ex.: UTFPR) com os pesos do termo de adesão e as notas de corte de referência.</p>
        </div>
        <Button onClick={() => setEdit("new")}><Plus aria-hidden /> Curso</Button>
      </header>
      <Input placeholder="Buscar curso, campus ou instituição" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar curso" />
      <ul className="grid gap-2">
        {list.map((c) => (
          <li key={c.id}>
            <Card className="flex flex-col gap-2 p-4 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.institution} · {c.name}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge tone="primary">{c.via === "ufpr" ? "Vestibular UFPR" : "Sisu"}</Badge>
                  {c.campus && <Badge>{c.campus}{c.shift ? ` · ${c.shift}` : ""}</Badge>}
                  {c.ufpr_specific.map((s) => <Badge key={s.subject} tone="warning">{s.subject} ×{s.weight.toLocaleString("pt-BR")}</Badge>)}
                  {c.via === "sisu" && <Badge tone={c.sisu_weights ? "success" : "warning"}>{c.sisu_weights ? `pesos L${c.sisu_weights.linguagens} H${c.sisu_weights.humanas} N${c.sisu_weights.natureza} M${c.sisu_weights.matematica} R${c.sisu_weights.redacao}` : "sem pesos"}</Badge>}
                  <Badge tone={c.course_cutoffs.length ? "success" : "neutral"}>{c.course_cutoffs.length ? `${c.course_cutoffs.length} notas de corte` : "sem corte"}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCut(c)}>Notas de corte</Button>
                <Button variant="outline" size="icon" aria-label={`Editar ${c.name}`} onClick={() => setEdit(c)}><Pencil /></Button>
                <Button variant="outline" size="icon" aria-label={`Remover ${c.name}`} disabled={pending} onClick={() => {
                  if (!window.confirm("Remover este curso? Alunos deixam de vê-lo como alvo.")) return;
                  start(async () => { const r = await deleteCourseAction(c.id); if (r.ok) router.refresh(); else toast.error(r.error); });
                }}><Trash2 /></Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="md:max-w-xl">{edit && <CourseForm row={edit === "new" ? null : edit} onDone={() => { setEdit(null); router.refresh(); }} />}</DialogContent>
      </Dialog>
      <Dialog open={!!cut} onOpenChange={(o) => !o && setCut(null)}>
        <DialogContent className="md:max-w-xl">{cut && <CutoffForm course={rows.find((r) => r.id === cut.id) ?? cut} onSaved={() => router.refresh()} />}</DialogContent>
      </Dialog>
    </div>
  );
}

function CourseForm({ row, onDone }: { row: CourseAdminRow | null; onDone: () => void }) {
  const [via, setVia] = useState<"ufpr" | "sisu">(row?.via ?? "sisu");
  const [specific, setSpecific] = useState<string[]>(row?.ufpr_specific.map((s) => s.subject) ?? []);
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-3" onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      const weights = via === "sisu" ? { linguagens: f.w_l, humanas: f.w_h, natureza: f.w_n, matematica: f.w_m, redacao: f.w_r } : undefined;
      start(async () => {
        const r = await saveCourseAction({ id: row?.id, institution: f.institution, via, name: f.name, campus: f.campus, shift: f.shift, notes: f.notes, specific, weights });
        if (r.ok) { toast.success("Curso salvo"); onDone(); } else toast.error(r.error);
      });
    }}>
      <DialogTitle>{row ? "Editar curso" : "Novo curso"}</DialogTitle>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1"><Label htmlFor="via">Seleção</Label>
          <select id="via" className={sel} value={via} onChange={(e) => setVia(e.target.value as "ufpr" | "sisu")}><option value="sisu">Sisu (ENEM)</option><option value="ufpr">Vestibular UFPR</option></select></div>
        <div className="grid gap-1"><Label htmlFor="institution">Instituição</Label><Input id="institution" name="institution" defaultValue={row?.institution ?? (via === "ufpr" ? "UFPR" : "UTFPR")} required /></div>
      </div>
      <div className="grid gap-1"><Label htmlFor="name">Curso</Label><Input id="name" name="name" defaultValue={row?.name} required /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1"><Label htmlFor="campus">Campus</Label><Input id="campus" name="campus" defaultValue={row?.campus ?? ""} /></div>
        <div className="grid gap-1"><Label htmlFor="shift">Turno</Label><Input id="shift" name="shift" defaultValue={row?.shift ?? ""} /></div>
      </div>
      {via === "ufpr" ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Disciplinas com peso (até 2) — o peso segue o edital</legend>
          <div className="flex flex-wrap gap-2">
            {Object.keys(UFPR_2027_SUBJECTS).map((s) => (
              <label key={s} className="flex min-h-11 items-center gap-2 rounded-full border border-input px-3 text-sm">
                <input type="checkbox" checked={specific.includes(s)} disabled={!specific.includes(s) && specific.length >= 2}
                  onChange={(e) => setSpecific((l) => (e.target.checked ? [...l, s] : l.filter((x) => x !== s)))} /> {s}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Pesos Sisu do curso</legend>
          <div className="grid grid-cols-5 gap-2">
            {[["w_l", "Ling.", "linguagens"], ["w_h", "Hum.", "humanas"], ["w_n", "Nat.", "natureza"], ["w_m", "Mat.", "matematica"], ["w_r", "Red.", "redacao"]].map(([n, l, k]) => (
              <div key={n} className="grid gap-1"><Label htmlFor={n}>{l}</Label><Input id={n} name={n} type="number" step="0.1" min={0} defaultValue={row?.sisu_weights?.[k] ?? 1} /></div>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid gap-1"><Label htmlFor="notes">Observações</Label><Input id="notes" name="notes" defaultValue={row?.notes ?? ""} /></div>
      <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} Salvar</Button>
    </form>
  );
}

function CutoffForm({ course, onSaved }: { course: CourseAdminRow; onSaved: () => void }) {
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-3">
      <DialogTitle>Notas de corte</DialogTitle>
      <DialogDescription>{course.institution} · {course.name}. Use a nota do último colocado de referência (ex.: chamada geral do ano anterior).</DialogDescription>
      <ul className="grid gap-1 text-sm">
        {course.course_cutoffs.sort((a, b) => b.year - a.year).map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 rounded-control border border-border px-3 py-2">
            <span>{c.year} · {c.modality}: <strong>{Number(c.cutoff).toLocaleString("pt-BR")}</strong>{c.source ? <span className="text-xs text-muted-foreground"> · {c.source}</span> : null}</span>
            <Button variant="ghost" size="icon" aria-label="Remover nota de corte" onClick={() => start(async () => { await deleteCutoffAction(c.id); onSaved(); })}><Trash2 /></Button>
          </li>
        ))}
        {course.course_cutoffs.length === 0 && <li className="text-muted-foreground">Nenhuma ainda.</li>}
      </ul>
      <form className="grid grid-cols-2 gap-2 sm:grid-cols-4" onSubmit={(e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        const form = e.currentTarget;
        start(async () => { const r = await saveCutoffAction({ ...f, course_id: course.id }); if (r.ok) { toast.success("Nota salva"); form.reset(); onSaved(); } else toast.error(r.error); });
      }}>
        <div className="grid gap-1"><Label htmlFor="year">Ano</Label><Input id="year" name="year" type="number" defaultValue={new Date().getFullYear() - 1} /></div>
        <div className="grid gap-1"><Label htmlFor="modality">Modalidade</Label><Input id="modality" name="modality" defaultValue="ampla" /></div>
        <div className="grid gap-1"><Label htmlFor="cutoff">Nota</Label><Input id="cutoff" name="cutoff" type="number" step="0.001" required /></div>
        <div className="grid gap-1"><Label htmlFor="source">Fonte</Label><Input id="source" name="source" placeholder="opcional" /></div>
        <Button type="submit" className="col-span-2 sm:col-span-4" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} Adicionar</Button>
      </form>
    </div>
  );
}
