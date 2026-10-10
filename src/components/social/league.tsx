"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { DEMOTE, PROMOTE, TIERS, type Card } from "@/lib/social";
import { cn } from "@/lib/utils";
import { Avatar, handle } from "./avatar";

function useCountdown(end: string) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(end).getTime() - Date.now()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [end]);
  if (left === null) return "";
  const d = Math.floor(left / 86_400_000), h = Math.floor((left % 86_400_000) / 3_600_000), m = Math.floor((left % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}min` : `${m} min`;
}

/** Liga da semana: grupo de até 30 na mesma divisão; top 7 sobe, os 5 últimos descem. */
export function League({ league, meId, weekEnd }: { league: { tier: number; moved: number; members: Card[] } | null; meId: string; weekEnd: string }) {
  const left = useCountdown(weekEnd);
  if (!league) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border p-6 text-center">
        <span className="text-5xl" aria-hidden>🪵</span>
        <p className="font-bold">Você ainda não entrou na liga desta semana</p>
        <p className="text-sm text-muted-foreground">Responda qualquer questão para ganhar XP e entrar na divisão {TIERS[0].name}. Toda semana os 7 primeiros sobem de divisão.</p>
      </div>
    );
  }
  const tier = TIERS[league.tier];
  const n = league.members.length;
  const demoteFrom = n >= 10 ? n - DEMOTE : Infinity;
  return (
    <div className="flex flex-col gap-4">
      <div className={cn("flex items-center gap-4 rounded-card p-4", tier.tone)}>
        <span className="text-5xl" aria-hidden>{tier.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide opacity-80">Divisão</p>
          <p className="font-display text-2xl font-extrabold">{tier.name}</p>
          <p className="text-sm">{league.moved === 1 ? "Você subiu na semana passada! 🎉 " : league.moved === -1 ? "Você desceu, mas dá para voltar. " : ""}Termina em <strong>{left}</strong></p>
        </div>
      </div>
      <ol className="stagger grid gap-1">
        {league.members.map((c, i) => {
          const zone = i < PROMOTE && league.tier < TIERS.length - 1 && c.week_xp > 0 ? "up" : i >= demoteFrom && league.tier > 0 ? "down" : null;
          return (
            <li key={c.id} className={cn("flex items-center gap-3 rounded-card p-2.5", c.id === meId && "bg-primary-soft text-primary-soft-foreground ring-1 ring-primary")}>
              <span className="w-6 text-center text-sm font-extrabold tabular-nums">{i + 1}</span>
              <Avatar card={c} size="sm" />
              <span className="min-w-0 flex-1 truncate font-semibold">{handle(c)}{c.id === meId && " (você)"}</span>
              {zone === "up" && <ArrowUp className="size-4 text-success" aria-label="zona de promoção" />}
              {zone === "down" && <ArrowDown className="size-4 text-danger" aria-label="zona de rebaixamento" />}
              <span className="w-20 text-right text-sm font-extrabold tabular-nums">{c.week_xp} XP</span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted-foreground">
        <ArrowUp className="inline size-3 text-success" aria-hidden /> os {PROMOTE} primeiros sobem de divisão · <ArrowDown className="inline size-3 text-danger" aria-hidden /> os {DEMOTE} últimos descem (em grupos com 10 ou mais). Só aparecem @apelido, avatar e XP.
      </p>
    </div>
  );
}
