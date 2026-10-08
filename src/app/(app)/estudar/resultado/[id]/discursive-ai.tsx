"use client";

import { useQuery } from "@tanstack/react-query";
import { Bot, Check, Loader2, Sparkles, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { requestDiscursiveAction } from "@/app/(app)/redacao/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type Fb = { question_id: string; score: number; max_score: number; feedback: { found: string[]; missing: string[]; feedback: string } };

/** Correção em lote de TODAS as discursivas da prova numa única chamada (1 cota). */
export function DiscursiveAi({ attemptId, questionIds, aiReady }: { attemptId: string; questionIds: string[]; aiReady: boolean }) {
  const [supabase] = useState(() => createClient());
  const [jobId, setJobId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fb = useQuery({
    queryKey: ["discursive", attemptId, jobId],
    queryFn: async () => {
      const [{ data: rows }, job] = await Promise.all([
        supabase.from("discursive_feedback").select("question_id, score, max_score, feedback").eq("attempt_id", attemptId),
        jobId ? supabase.from("ai_jobs").select("status, error").eq("id", jobId).single() : Promise.resolve({ data: null }),
      ]);
      return { rows: (rows ?? []) as Fb[], job: job.data as { status: string; error: string | null } | null };
    },
    refetchInterval: (q) => (q.state.data?.job && ["queued", "running"].includes(q.state.data.job.status) ? 3000 : false),
  });
  const rows = fb.data?.rows ?? [];
  const job = fb.data?.job;
  const running = job && ["queued", "running"].includes(job.status);

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 && !running && (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm"><Bot className="mr-1 inline size-4" aria-hidden /> A IA compara suas respostas com o espelho oficial. Todas as {questionIds.length} discursivas desta prova numa só correção (usa 1 da cota diária).</p>
          <Button disabled={pending || !aiReady} onClick={() => start(async () => {
            const r = await requestDiscursiveAction(attemptId);
            if (r.ok) setJobId(r.data.jobId);
            else toast.error(r.error);
          })}>{pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />} {aiReady ? "Corrigir com IA" : "IA não configurada"}</Button>
        </Card>
      )}
      {running && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Corrigindo as discursivas…</p>}
      {job?.status === "failed" && <p role="alert" className="text-sm text-danger">A correção falhou ({job.error}). Não contou na sua cota: tente de novo.</p>}
      {rows.map((r, i) => (
        <Card key={r.question_id} className="grid gap-2 p-4" data-question={r.question_id}>
          <p className="font-bold">Discursiva {questionIds.indexOf(r.question_id) + 1 || i + 1}: {Number(r.score).toLocaleString("pt-BR")} / {Number(r.max_score).toLocaleString("pt-BR")} <span className="text-xs font-normal text-muted-foreground">(estimativa da IA)</span></p>
          <p className="text-sm">{r.feedback.feedback}</p>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <ul className="grid gap-1">{r.feedback.found.map((x, k) => <li key={k} className="flex gap-1"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-label="Presente" /> {x}</li>)}</ul>
            <ul className="grid gap-1">{r.feedback.missing.map((x, k) => <li key={k} className="flex gap-1"><X className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Faltou" /> {x}</li>)}</ul>
          </div>
        </Card>
      ))}
    </div>
  );
}
