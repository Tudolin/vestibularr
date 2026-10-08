"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label } from "@/components/ui/input";
import { deleteQuestionAction, updateQuestionAction } from "../actions";

type Initial = {
  id: string; area: string; subject: string; topic: string; work_id: string; is_active: boolean; statement_md: string;
  kind: "objective" | "discursive"; alternatives: { label: string; text_md: string }[]; correct: string; explanation_md: string; official_mirror_md: string;
};
const selectCls = "h-11 w-full rounded-control border border-input bg-card px-3 text-base md:text-sm";
const areaTa = "min-h-24 w-full rounded-control border border-input bg-card p-3 text-base md:text-sm";

export function QuestionEditor({ initial, works }: { initial: Initial; works: { id: string; title: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Initial>(k: K, val: Initial[K]) => setV((s) => ({ ...s, [k]: val }));

  function save() {
    setError(null);
    start(async () => {
      const r = await updateQuestionAction({ ...v });
      if (r.ok) { toast.success("Questão salva"); router.refresh(); } else setError(r.error);
    });
  }
  function remove() {
    if (!window.confirm("Excluir esta questão definitivamente? Respostas de alunos a ela também serão removidas.")) return;
    start(async () => {
      const r = await deleteQuestionAction(initial.id);
      if (r.ok) { toast.success("Questão excluída"); router.push("/admin/questoes"); } else setError(r.error);
    });
  }

  return (
    <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="area">Área</Label>
          <select id="area" className={selectCls} value={v.area} onChange={(e) => set("area", e.target.value)}>
            <option value="">—</option>
            <option value="linguagens">Linguagens</option><option value="humanas">Humanas</option>
            <option value="natureza">Natureza</option><option value="matematica">Matemática</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="work">Obra</Label>
          <select id="work" className={selectCls} value={v.work_id} onChange={(e) => set("work_id", e.target.value)}>
            <option value="">—</option>
            {works.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}
          </select>
        </div>
        <div className="grid gap-1.5"><Label htmlFor="subject">Disciplina</Label><Input id="subject" value={v.subject} onChange={(e) => set("subject", e.target.value)} /></div>
        <div className="grid gap-1.5"><Label htmlFor="topic">Assunto</Label><Input id="topic" value={v.topic} onChange={(e) => set("topic", e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
          <input type="checkbox" className="size-5" checked={v.is_active} onChange={(e) => set("is_active", e.target.checked)} />
          Ativa (visível para os alunos)
        </label>
      </Card>

      <Card className="grid gap-3 p-5">
        <Label htmlFor="statement">Enunciado (markdown)</Label>
        <textarea id="statement" className={`${areaTa} min-h-48 font-mono`} value={v.statement_md} onChange={(e) => set("statement_md", e.target.value)} />
      </Card>

      {v.kind === "objective" && (
        <Card className="grid gap-3 p-5">
          <h2 className="font-bold">Alternativas e gabarito</h2>
          {v.alternatives.map((a, i) => (
            <div key={a.label} className="flex items-start gap-2">
              <span className="mt-2 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">{a.label}</span>
              <textarea aria-label={`Alternativa ${a.label}`} className={`${areaTa} min-h-14`} value={a.text_md}
                onChange={(e) => set("alternatives", v.alternatives.map((x, j) => (j === i ? { ...x, text_md: e.target.value } : x)))} />
              <label className="mt-2 flex items-center gap-1 text-sm font-medium">
                <input type="radio" name="correct" className="size-5" checked={v.correct === a.label} onChange={() => set("correct", a.label)} aria-label={`Marcar ${a.label} como correta`} />
                Certa
              </label>
            </div>
          ))}
        </Card>
      )}

      <Card className="grid gap-3 p-5">
        <Label htmlFor="expl">{v.kind === "objective" ? "Resolução comentada (opcional)" : "Espelho oficial de resposta"}</Label>
        <textarea id="expl" className={areaTa}
          value={v.kind === "objective" ? v.explanation_md : v.official_mirror_md}
          onChange={(e) => set(v.kind === "objective" ? "explanation_md" : "official_mirror_md", e.target.value)} />
      </Card>

      <FieldError>{error ?? undefined}</FieldError>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} Salvar</Button>
        <Button type="button" variant="danger" size="lg" disabled={pending} onClick={remove}><Trash2 aria-hidden /> Excluir</Button>
      </div>
    </form>
  );
}
