"use client";

import { GraduationCap, Info, Loader2, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { setTargetCoursesAction } from "@/app/(app)/desempenho/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type CourseOption = { id: string; label: string; via: "ufpr" | "sisu" };
export type CourseResult = {
  id: string; label: string; via: "ufpr" | "sisu"; score: number | null; scale: string;
  cutoff: { value: number; year: number; modality: string } | null; notes: string[];
};

export function CoursesCard({ results, options, selected, editable }: { results: CourseResult[]; options: CourseOption[]; selected: string[]; editable: boolean }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string[]>(selected);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const filtered = useMemo(() => options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())).slice(0, 60), [options, q]);
  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><GraduationCap className="size-4" aria-hidden /> Cursos-alvo</CardTitle>
        {editable && <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Settings2 aria-hidden /> Escolher</Button>}
      </CardHeader>
      <CardContent className="grid gap-3">
        {results.length === 0 && <p className="text-sm text-muted-foreground">Escolha seus cursos para ver a nota estimada e a distância até a nota de corte.</p>}
        {results.map((r) => {
          const diff = r.score != null && r.cutoff ? r.score - r.cutoff.value : null;
          return (
            <div key={r.id} className="grid gap-1 rounded-control border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex-1 font-semibold">{r.label}</p>
                <Badge tone="primary">{r.via === "ufpr" ? "Vestibular UFPR" : "Sisu (ENEM)"}</Badge>
              </div>
              <p className="text-sm">
                Nota estimada: <strong>{r.score == null ? "—" : fmt(r.score)}</strong> <span className="text-muted-foreground">({r.scale})</span>
                {r.cutoff && <> · corte {r.cutoff.year} ({r.cutoff.modality}): <strong>{fmt(r.cutoff.value)}</strong></>}
              </p>
              {diff != null && <Badge tone={diff >= 0 ? "success" : "danger"} className="justify-self-start">{diff >= 0 ? `+${fmt(diff)} acima do corte` : `faltam ${fmt(-diff)} pontos`}</Badge>}
              {!r.cutoff && <p className="text-xs text-muted-foreground">Sem nota de corte cadastrada (o admin cadastra em Cursos).</p>}
              {r.notes.map((n, i) => <p key={i} className="flex gap-1 text-xs text-muted-foreground"><Info className="mt-0.5 size-3 shrink-0" aria-hidden />{n}</p>)}
            </div>
          );
        })}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="md:max-w-xl">
          <DialogTitle>Escolha até 6 cursos</DialogTitle>
          <DialogDescription>Cursos da UFPR (vestibular) e cursos via Sisu cadastrados pelo admin.</DialogDescription>
          <Input placeholder="Buscar curso ou campus" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar curso" />
          <ul className="grid max-h-72 gap-1 overflow-y-auto">
            {filtered.map((o) => (
              <li key={o.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-control px-2 hover:bg-muted">
                  <input type="checkbox" className="size-5" checked={pick.includes(o.id)} disabled={!pick.includes(o.id) && pick.length >= 6}
                    onChange={(e) => setPick((p) => (e.target.checked ? [...p, o.id] : p.filter((x) => x !== o.id)))} />
                  <span className="text-sm">{o.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <Button size="lg" disabled={pending} onClick={() => start(async () => {
            const r = await setTargetCoursesAction(pick);
            if (r.ok) { toast.success("Cursos salvos"); setOpen(false); router.refresh(); } else toast.error(r.error);
          })}>{pending && <Loader2 className="animate-spin" aria-hidden />} Salvar ({pick.length}/6)</Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
