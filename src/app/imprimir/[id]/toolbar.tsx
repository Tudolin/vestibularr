"use client";

import { ArrowLeft, ClipboardCheck, Loader2, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { answerSheetAction } from "@/app/(app)/estudar/exportar/actions";
import { Button } from "@/components/ui/button";
import { needsInternet } from "@/lib/use-online";

/** Barra (some na impressão): imprimir/salvar PDF, incluir folha de respostas e lançar as respostas no app. */
export function PrintToolbar({ id, title, count }: { id: string; title: string; count: number }) {
  const router = useRouter();
  const [sheet, setSheet] = useState(true);
  const [pending, start] = useTransition();
  return (
    <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-3 backdrop-blur print:hidden" data-sheet={sheet}>
      {/* a folha de respostas entra ou não na impressão */}
      <style>{`${sheet ? "" : ".print-doc .cartao{display:none}"} @page{margin:14mm} .print-md img{max-width:100%;max-height:22rem;margin:.5rem auto} .print-md p{margin:.35rem 0} .print-md table{border-collapse:collapse} .print-md td,.print-md th{border:1px solid #999;padding:2px 6px} @media print{.alts{break-inside:avoid}.question>p:first-child{break-after:avoid}.question img{break-inside:avoid}}`}</style>
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/estudar/exportar"><ArrowLeft aria-hidden /> Voltar</Link></Button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{title} · {count} questões</p>
        <label className="flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={sheet} onChange={(e) => setSheet(e.target.checked)} className="size-5 accent-primary" /> Folha de respostas
        </label>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
          if (needsInternet("Lançar respostas")) return;
          const r = await answerSheetAction(id);
          if (!r.ok) return void toast.error(r.error);
          router.push(`/prova/${r.data}`);
        })}>{pending ? <Loader2 className="animate-spin" aria-hidden /> : <ClipboardCheck aria-hidden />} Lançar respostas no app</Button>
        <Button size="sm" onClick={() => window.print()}><Printer aria-hidden /> Salvar PDF / imprimir</Button>
      </div>
      <p className="mx-auto mt-1 max-w-3xl text-xs text-muted-foreground">No celular: toque em “Salvar PDF / imprimir” e escolha “Salvar como PDF” (Android) ou compartilhe → “Salvar em Arquivos” (iPhone).</p>
    </div>
  );
}
