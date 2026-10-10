"use client";

import { Check, Flame, Loader2, Shield, Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { startDailyAction } from "@/app/(app)/inicio/actions";
import { Button } from "@/components/ui/button";
import type { DailyStatus } from "@/lib/daily";
import { needsInternet } from "@/lib/use-online";
import { cn } from "@/lib/utils";

/** Cartão do desafio do dia: sequência, escudos, semana e o botão para começar/continuar. */
export function DailyCard({ s }: { s: DailyStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = () => start(async () => {
    if (s.attempt_id) return router.push(`/prova/${s.attempt_id}`);
    if (needsInternet("Montar o desafio do dia")) return;
    const r = await startDailyAction();
    if (!r.ok) return void toast.error(r.error);
    router.push(`/prova/${r.data}`);
  });
  const pct = s.total ? Math.round((s.answered / s.total) * 100) : 0;
  const atRisk = !s.studied_today && s.streak > 0;

  return (
    <section aria-labelledby="desafio" className={cn("overflow-hidden rounded-card border-2 bg-card", s.completed ? "border-success/50" : "border-primary/50")}>
      <div className="flex flex-wrap items-center gap-4 p-5">
        <div className="relative flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-warning-soft text-warning-soft-foreground">
          <Flame className={cn("size-7", s.studied_today && "animate-[pulse_2s_ease-in-out_infinite] text-orange-500")} aria-hidden />
          <span className="text-sm font-extrabold tabular-nums leading-none">{s.streak}</span>
        </div>
        <div className="min-w-[12rem] flex-1">
          <h2 id="desafio" className="text-lg font-extrabold">Desafio do dia</h2>
          <p className="text-sm text-muted-foreground">
            {s.completed ? `Arr! Desafio vencido: ${s.correct}/${s.total} acertos. Volte amanhã para manter a sequência 🔥`
              : s.attempt_id ? `${s.answered} de ${s.total} respondidas${s.focus ? ` · foco: ${s.focus}` : ""}`
              : "7 questões, ~10 minutos, escolhidas para você. A última é o chefão: XP em dobro ⚔️"}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
            <span>🔥 {s.streak} {s.streak === 1 ? "dia seguido" : "dias seguidos"}</span>
            <span className="inline-flex items-center gap-1" title="Escudo de sequência: protege 1 dia perdido. Ganha 1 a cada 7 dias seguidos (máx. 2).">
              <Shield className="size-3.5 text-primary" aria-hidden /> {s.shields}/2 escudos
            </span>
            {atRisk && <span className="text-warning-soft-foreground">Estude hoje para não perder a sequência!</span>}
          </p>
        </div>
        {s.completed ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-4 py-2 text-sm font-bold text-success-soft-foreground"><Check className="size-4" aria-hidden /> +30 XP</span>
        ) : (
          <Button size="lg" disabled={pending} onClick={go} className="w-full sm:w-auto">
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Swords aria-hidden />} {s.attempt_id ? "Seguir viagem" : "Zarpar!"}
          </Button>
        )}
      </div>
      {s.attempt_id && !s.completed && (
        <div className="h-1.5 bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do desafio">
          <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}
    </section>
  );
}
