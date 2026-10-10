"use client";

import { BookOpen, FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Facets } from "@/lib/attempts/queries";
import { needsInternet } from "@/lib/use-online";
import { cn } from "@/lib/utils";
import { createExportAction } from "./actions";

const AREA_LABEL: Record<string, string> = { linguagens: "Linguagens", humanas: "Humanas", natureza: "Natureza", matematica: "Matemática" };

function Chip({ on, onClick, children, role = "checkbox" }: { on: boolean; onClick: () => void; children: React.ReactNode; role?: "checkbox" | "radio" }) {
  return (
    <button type="button" role={role} aria-checked={on} onClick={onClick}
      className={cn("min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors", on ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-input bg-card text-foreground hover:bg-muted")}>
      {on && "✓ "}{children}
    </button>
  );
}

export type AttemptOpt = { id: string; title: string; when: string };

/** Monta a lista: origem (banco, caderno de erros ou um simulado feito), filtros, tamanho, gabarito e formato. */
export function ExportForm({ facets, maxSize, attempts, errorsCount, initialAttempt }: {
  facets: Facets; maxSize: number; attempts: AttemptOpt[]; errorsCount: number; initialAttempt?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [source, setSource] = useState<"banco" | "erros" | "tentativa">(initialAttempt ? "tentativa" : "banco");
  const [attempt, setAttempt] = useState(initialAttempt ?? attempts[0]?.id ?? "");
  const [onlyWrong, setOnlyWrong] = useState(true);
  const [board, setBoard] = useState<"" | "ENEM" | "UFPR">("");
  const [areas, setAreas] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [count, setCount] = useState(Math.min(20, maxSize));
  const [order, setOrder] = useState<"assunto" | "aleatoria">("assunto");
  const [withAnswers, setWithAnswers] = useState(true);
  const [title, setTitle] = useState("");

  const toggle = (set: (f: (v: string[]) => string[]) => void, v: string) => set((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  const areaOpts = useMemo(() => [...new Set(facets.areas.filter((a) => !board || a.board === board).map((a) => a.name))], [facets, board]);
  const subjectOpts = useMemo(() => [...new Map(facets.subjects.filter((s) => !board || s.board === board).map((s) => [s.name, s])).values()], [facets, board]);

  const go = (format: "pdf" | "epub") => start(async () => {
    if (needsInternet("Montar uma lista nova")) return;
    const r = await createExportAction({
      source, attempt_id: source === "tentativa" ? attempt : undefined, only_wrong: source === "tentativa" ? onlyWrong : undefined,
      board: source === "banco" && board ? board : undefined,
      areas: source === "banco" && areas.length ? areas : undefined, subjects: source === "banco" && subjects.length ? subjects : undefined,
      count, order, with_answers: withAnswers, title: title.trim() || undefined,
    });
    if (!r.ok) return void toast.error(r.error);
    if (format === "pdf") router.push(`/imprimir/${r.data}`);
    else {
      toast.success("Gerando o EPUB… o download começa em instantes.");
      window.location.assign(`/api/exportar/${r.data}/epub`);
      router.refresh();
    }
  });

  return (
    <Card className="grid gap-5 p-5">
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-bold">De onde vêm as questões?</legend>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          <Chip role="radio" on={source === "banco"} onClick={() => setSource("banco")}>Banco de questões</Chip>
          <Chip role="radio" on={source === "erros"} onClick={() => setSource("erros")}>Caderno de erros{errorsCount ? ` (${errorsCount})` : ""}</Chip>
          {attempts.length > 0 && <Chip role="radio" on={source === "tentativa"} onClick={() => setSource("tentativa")}>Um simulado que fiz</Chip>}
        </div>
      </fieldset>

      {source === "tentativa" && (
        <div className="grid gap-2">
          <label className="grid gap-1.5 text-sm font-semibold">
            Simulado
            <select value={attempt} onChange={(e) => setAttempt(e.target.value)} className="h-11 rounded-control border border-input bg-card px-3 text-base">
              {attempts.map((a) => <option key={a.id} value={a.id}>{a.title} · {a.when}</option>)}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} className="size-5 accent-primary" /> Só as que errei ou deixei em branco
          </label>
        </div>
      )}

      {source === "banco" && (
        <>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-bold">Vestibular</legend>
            <div className="flex flex-wrap gap-2">
              {(["", "ENEM", "UFPR"] as const).map((b) => (
                <Chip key={b || "all"} role="radio" on={board === b} onClick={() => { setBoard(b); setAreas([]); setSubjects([]); }}>{b || "Todos"}</Chip>
              ))}
            </div>
          </fieldset>
          {areaOpts.length > 0 && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-bold">Áreas</legend>
              <div className="flex flex-wrap gap-2">{areaOpts.map((a) => <Chip key={a} on={areas.includes(a)} onClick={() => toggle(setAreas, a)}>{AREA_LABEL[a] ?? a}</Chip>)}</div>
            </fieldset>
          )}
          {subjectOpts.length > 0 && (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-bold">Disciplinas <span className="font-normal text-muted-foreground">(opcional)</span></legend>
              <div className="flex flex-wrap gap-2">{subjectOpts.map((s) => <Chip key={s.name} on={subjects.includes(s.name)} onClick={() => toggle(setSubjects, s.name)}>{s.name}</Chip>)}</div>
            </fieldset>
          )}
        </>
      )}

      <label className="grid gap-1.5 text-sm font-semibold">
        <span className="flex justify-between"><span>Quantidade</span><span className="tabular-nums text-primary">{count} questões</span></span>
        <input type="range" min={1} max={maxSize} value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-11 accent-primary" />
        <span className="text-xs font-normal text-muted-foreground">Seu plano permite até {maxSize} por lista.</span>
      </label>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-bold">Ordem</legend>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          <Chip role="radio" on={order === "assunto"} onClick={() => setOrder("assunto")}>Por disciplina (apostila)</Chip>
          <Chip role="radio" on={order === "aleatoria"} onClick={() => setOrder("aleatoria")}>Misturada (como na prova)</Chip>
        </div>
      </fieldset>

      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={withAnswers} onChange={(e) => setWithAnswers(e.target.checked)} className="size-5 accent-primary" />
        <span>Incluir gabarito e resoluções comentadas no final</span>
      </label>

      <label className="grid gap-1.5 text-sm font-semibold">
        Nome da lista <span className="font-normal text-muted-foreground">(opcional)</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="ex.: Revisão de Física — semana 3" />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button size="lg" disabled={pending} onClick={() => go("pdf")}>{pending ? <Loader2 className="animate-spin" aria-hidden /> : <FileText aria-hidden />} Gerar PDF</Button>
        <Button size="lg" variant="outline" disabled={pending} onClick={() => go("epub")}><BookOpen aria-hidden /> Gerar EPUB</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        PDF: abre a versão para imprimir ou salvar em PDF, com folha de respostas. EPUB: para Kindle, Apple Livros ou Google Play Livros (as figuras vão junto e funcionam offline).
      </p>
    </Card>
  );
}
