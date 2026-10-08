"use client";

import { AlertTriangle, FileUp, Loader2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AREAS, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { excerpt } from "@/components/markdown";
import { chunkBundle } from "@/lib/import/chunk";
import { MAX_IMPORT_BYTES, parseImportText } from "@/lib/import/parse";
import type { ValidationResult } from "@/lib/import/schema";

type Props = {
  /** admin: grava direto (em pedaços). student: envia para revisão. */
  mode: "admin" | "student";
  importChunk?: (raw: unknown) => Promise<{ ok: true; inserted: number; updated: number } | { ok: false; error: string }>;
  submitFile?: (filename: string, text: string) => Promise<{ ok: true; questions: number } | { ok: false; error: string }>;
};

/** Escolhe .json/.csv, valida no navegador e mostra prévia ANTES de gravar qualquer coisa. */
export function ImportUploader({ mode, importChunk, submitFile }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [onlyValid, setOnlyValid] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, start] = useTransition();

  async function onPick(f: File | undefined) {
    setResult(null);
    setFile(null);
    if (!f) return;
    if (f.size > MAX_IMPORT_BYTES) return void toast.error("Arquivo maior que 8 MB.");
    const text = await f.text();
    setFile({ name: f.name, text });
    setResult(parseImportText(f.name, text));
  }

  const bundle = result?.bundle;
  // Qualquer problema (questão ou prova descartada) exige consentimento explícito para seguir só com o válido.
  const hasInvalid = (result?.issues.length ?? 0) > 0;
  const canGo = !!bundle && (result?.summary.questions ?? 0) > 0 && (!hasInvalid || onlyValid) && !pending;

  function run() {
    if (!bundle || !file) return;
    start(async () => {
      if (mode === "student") {
        const r = await submitFile!(file.name, file.text);
        if (r.ok) {
          toast.success(`${r.questions} questões enviadas para revisão`);
          reset();
        } else toast.error(r.error);
        return;
      }
      const parts = chunkBundle(bundle, 100);
      let ins = 0, upd = 0;
      for (let i = 0; i < parts.length; i++) {
        setProgress(Math.round((i / parts.length) * 100));
        const r = await importChunk!(parts[i]);
        if (!r.ok) {
          setProgress(null);
          return void toast.error(`Falhou no pedaço ${i + 1}/${parts.length}: ${r.error}. Os anteriores já foram gravados; reenviar é seguro (atualiza, não duplica).`);
        }
        ins += r.inserted;
        upd += r.updated;
      }
      setProgress(null);
      toast.success(`Importação concluída: ${ins} novas, ${upd} atualizadas`);
      reset();
    });
  }

  function reset() {
    setFile(null);
    setResult(null);
    setOnlyValid(false);
    if (input.current) input.current.value = "";
  }

  const sample = bundle ? [...bundle.exams.flatMap((e) => e.questions), ...bundle.questions].slice(0, 3) : [];

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col items-start gap-3 p-5">
        <input ref={input} id="arquivo" type="file" accept=".json,.csv,application/json,text/csv" className="sr-only" onChange={(e) => onPick(e.target.files?.[0])} />
        <Button asChild variant="outline" size="lg">
          <label htmlFor="arquivo" className="cursor-pointer"><FileUp aria-hidden /> Escolher arquivo .json ou .csv</label>
        </Button>
        {file && <p className="text-sm text-muted-foreground">{file.name}</p>}
      </Card>

      {result && (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-2 text-lg font-bold">Prévia</h2>
            {bundle && <Badge tone="primary">{bundle.board}</Badge>}
            <Badge tone="success">{result.summary.questions} válidas</Badge>
            <Badge tone="neutral">{result.summary.exams} provas</Badge>
            {hasInvalid && <Badge tone="danger">{result.summary.invalid} inválidas</Badge>}
            {result.summary.withoutKey > 0 && <Badge tone="warning">{result.summary.withoutKey} sem gabarito</Badge>}
          </div>

          {result.issues.length > 0 && (
            <div role="alert" className="rounded-control bg-warning-soft p-3 text-sm text-warning-soft-foreground">
              <p className="mb-1 flex items-center gap-1.5 font-bold"><AlertTriangle className="size-4" aria-hidden /> Problemas encontrados ({result.issues.length})</p>
              <ul className="max-h-48 list-disc space-y-1 overflow-y-auto pl-5">
                {result.issues.slice(0, 50).map((i, k) => <li key={k}><strong>{i.where}:</strong> {i.message}</li>)}
              </ul>
              {result.issues.length > 50 && <p className="mt-1">…e mais {result.issues.length - 50}.</p>}
            </div>
          )}

          {sample.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">Primeiras questões</p>
              <ul className="grid gap-2">
                {sample.map((q, i) => (
                  <li key={i} className="rounded-control border border-border p-3 text-sm">
                    <span className="mr-2 font-bold">{q.number != null ? `Q${q.number}` : "Avulsa"}</span>
                    {q.area && <Badge tone={AREAS[q.area].tone}>{AREAS[q.area].label}</Badge>} <span className="ml-1">{excerpt(q.statement_md, 140)}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {q.kind === "objective" ? `${q.alternatives.length} alternativas · gabarito ${q.correct ?? "—"}` : "Discursiva"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasInvalid && bundle && (
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={onlyValid} onChange={(e) => setOnlyValid(e.target.checked)} className="size-5" />
              Importar só as {result.summary.questions} válidas e ignorar o que tem problema
            </label>
          )}

          {progress !== null && <Progress value={progress} label="Progresso da importação" />}

          <div className="flex gap-2">
            <Button size="lg" disabled={!canGo} onClick={run}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {mode === "admin" ? `Importar ${result.summary.questions} questões` : `Enviar ${result.summary.questions} questões para revisão`}
            </Button>
            <Button size="lg" variant="outline" onClick={reset} disabled={pending}>Cancelar</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
