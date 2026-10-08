import { AlertTriangle, Bot, Check, MessageSquareQuote, UserRound, X } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HighlightedText, type Highlight } from "./highlighted-text";

export type Correction = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  total: number | null;
  max_total: number | null;
  error: string | null;
  admin_comment: string | null;
  created_at: string;
  feedback: {
    annulled?: { value: boolean; reason?: string | null };
    criteria: { key: string; name: string; score: number; max: number; justification: string }[];
    highlights: Highlight[];
    suggestions: string[];
    intervention?: Record<"agent" | "action" | "means" | "purpose" | "detail", { present: boolean; quote?: string | null }>;
    mirror_comparison?: string | null;
    summary: string;
  } | null;
};

const INTERVENTION = { agent: "Agente", action: "Ação", means: "Meio/modo", purpose: "Finalidade", detail: "Detalhamento" } as const;
const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export function CorrectionView({ c, text }: { c: Correction; text: string }) {
  const f = c.feedback;
  if (!f) return null;
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Bot className="size-4" aria-hidden /> Nota estimada pela IA</p>
          <p className="text-4xl font-extrabold">{fmt(Number(c.total))}<span className="text-lg text-muted-foreground"> / {fmt(Number(c.max_total))}</span></p>
        </div>
        <p className="max-w-md text-sm text-muted-foreground">É uma estimativa para estudo: a banca real pode divergir. Use as justificativas para melhorar.</p>
      </Card>

      {f.annulled?.value && (
        <p role="alert" className="flex gap-2 rounded-control bg-danger-soft p-3 text-sm font-medium text-danger-soft-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> Texto anulado: {f.annulled.reason ?? "motivo não informado"}
        </p>
      )}

      {c.admin_comment && (
        <Card className="border-primary p-4">
          <p className="mb-1 flex items-center gap-2 text-sm font-bold"><UserRound className="size-4" aria-hidden /> Comentário do professor</p>
          <p className="whitespace-pre-line text-sm">{c.admin_comment}</p>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {f.criteria.map((k) => (
          <Card key={k.key} className="flex flex-col gap-2 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-bold">{k.name}</p>
              <p className="font-mono text-sm font-bold">{fmt(k.score)}/{fmt(k.max)}</p>
            </div>
            <Progress value={(k.score / k.max) * 100} label={`${k.name}: ${k.score} de ${k.max}`} />
            <p className="text-sm text-muted-foreground">{k.justification}</p>
          </Card>
        ))}
      </div>

      {f.intervention && (
        <Card>
          <CardHeader><CardTitle>Proposta de intervenção (C5)</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-5">
              {(Object.keys(INTERVENTION) as (keyof typeof INTERVENTION)[]).map((k) => {
                const it = f.intervention![k];
                return (
                  <li key={k} className={`flex flex-col gap-1 rounded-control border p-3 text-sm ${it.present ? "border-success" : "border-danger"}`}>
                    <span className="flex items-center gap-1 font-bold">{it.present ? <Check className="size-4 text-success" aria-hidden /> : <X className="size-4 text-danger" aria-hidden />} {INTERVENTION[k]}</span>
                    <span className="text-xs text-muted-foreground">{it.present ? (it.quote ? `“${it.quote}”` : "presente") : "faltou"}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareQuote className="size-4" aria-hidden /> Seu texto comentado</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <HighlightedText text={text} highlights={f.highlights} />
          {f.highlights.length > 0 && (
            <ol className="grid gap-2 text-sm">
              {f.highlights.map((h, i) => (
                <li key={i} className="flex gap-2">
                  <Badge tone={h.type === "acerto" ? "success" : h.type === "sugestao" ? "warning" : "danger"}>{i + 1}</Badge>
                  <span><span className="font-semibold">“{h.quote}”</span> — {h.comment}{h.criterion ? ` (${h.criterion})` : ""}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {f.mirror_comparison && (
        <Card><CardHeader><CardTitle>Comparação com o espelho oficial</CardTitle></CardHeader><CardContent><Markdown className="text-base">{f.mirror_comparison}</Markdown></CardContent></Card>
      )}
      <Card>
        <CardHeader><CardTitle>Resumo e sugestões</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p>{f.summary}</p>
          {f.suggestions.length > 0 && <ul className="list-disc space-y-1 pl-5">{f.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>}
        </CardContent>
      </Card>
    </div>
  );
}
