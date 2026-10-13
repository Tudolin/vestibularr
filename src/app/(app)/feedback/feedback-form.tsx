"use client";

import { Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FEEDBACK_KINDS, FEEDBACK_PAGES, RATING_FACES, type FeedbackKind } from "@/lib/feedback";
import { needsInternet } from "@/lib/use-online";
import { cn } from "@/lib/utils";
import { sendFeedbackAction } from "./actions";

export function FeedbackForm({ initialPage, initialKind }: { initialPage: string; initialKind?: FeedbackKind }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<FeedbackKind>(initialKind ?? "elogio");
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(initialPage);
  const [error, setError] = useState("");
  const k = FEEDBACK_KINDS.find((x) => x.key === kind)!;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3) return setError("Escreva um pouquinho mais.");
    start(async () => {
      if (needsInternet("Enviar feedback")) return;
      const r = await sendFeedbackAction({ kind, rating, message, page });
      if (!r.ok) return setError(r.error);
      setError("");
      setMessage("");
      setRating(null);
      toast.success("Arr! Recebemos seu feedback. Valeu, marujo! 🏴‍☠️");
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-bold">Sobre o que você quer falar?</legend>
          <div role="radiogroup" aria-label="Tipo de feedback" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FEEDBACK_KINDS.map((x) => (
              <button key={x.key} type="button" role="radio" aria-checked={kind === x.key} onClick={() => setKind(x.key)}
                className={cn("flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-card border-2 p-2 text-sm font-bold",
                  kind === x.key ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border bg-card hover:bg-muted")}>
                <span className="text-2xl" aria-hidden>{x.emoji}</span>{x.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-bold">Como está sendo usar o Vestibularr? <span className="font-normal text-muted-foreground">(opcional)</span></legend>
          <div role="radiogroup" aria-label="Nota da experiência" className="flex gap-2">
            {RATING_FACES.map((f, i) => (
              <button key={f} type="button" role="radio" aria-checked={rating === i + 1} aria-label={`${i + 1} de 5`} onClick={() => setRating(rating === i + 1 ? null : i + 1)}
                className={cn("flex size-12 items-center justify-center rounded-full border-2 text-2xl transition-transform",
                  rating === i + 1 ? "scale-110 border-primary bg-primary-soft" : "border-transparent opacity-70 hover:opacity-100")}>
                {f}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5">
          <span className="font-bold">Sua mensagem</span>
          <textarea value={message} onChange={(e) => { setMessage(e.target.value); setError(""); }} maxLength={2000} rows={5} required
            placeholder={k.hint} aria-invalid={!!error} aria-describedby={error ? "fb-erro" : undefined}
            className="min-h-32 w-full rounded-control border border-input bg-card p-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
          <span className="text-right text-xs text-muted-foreground">{message.length}/2000</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-bold">De qual parte do app? <span className="font-normal text-muted-foreground">(opcional)</span></span>
          <select value={page} onChange={(e) => setPage(e.target.value)} className="min-h-11 rounded-control border border-input bg-card px-3 text-base">
            {FEEDBACK_PAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>

        {error && <p id="fb-erro" role="alert" className="text-sm font-semibold text-danger">{error}</p>}
        <Button type="submit" size="lg" disabled={pending} className="self-start">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />} Enviar
        </Button>
      </form>
    </Card>
  );
}
