"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reactAction } from "@/app/(app)/tripulacao/actions";
import { describeEvent, REACTIONS, type FeedEvent } from "@/lib/social";
import { cn } from "@/lib/utils";
import { Avatar, handle } from "./avatar";
import { needsInternet } from "@/lib/use-online";

const ago = (iso: string, now: number) => {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "agora";
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
};

/** Mural: atividades automáticas com reações prontas (sem comentários livres). */
export function Feed({ events, now }: { events: FeedEvent[]; now: number }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">Ainda não há atividade. Faça um simulado ou a triagem e apareça aqui!</p>;
  return <ul className="stagger grid grid-cols-[minmax(0,1fr)] gap-2">{events.map((e) => <FeedItem key={e.id} e={e} now={now} />)}</ul>;
}

function FeedItem({ e, now }: { e: FeedEvent; now: number }) {
  const [reactions, setReactions] = useState(e.reactions);
  const [mine, setMine] = useState(new Set(e.mine));
  const [, start] = useTransition();
  const toggle = (emoji: string) => {
    // otimista: atualiza já e confirma com o servidor
    const had = mine.has(emoji);
    const next = new Set(mine); if (had) next.delete(emoji); else next.add(emoji);
    setMine(next);
    setReactions((r) => ({ ...r, [emoji]: Math.max(0, (r[emoji] ?? 0) + (had ? -1 : 1)) }));
    start(async () => {
      if (needsInternet("A Tripulação")) return;
      const r = await reactAction(e.id, emoji);
      if (r.ok && r.data) setReactions(r.data); else if (!r.ok) toast.error(r.error);
    });
  };
  return (
    <li className="rounded-card border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <Avatar card={e.user} size="sm" />
        <p className="min-w-0 flex-1 text-sm"><strong>{handle(e.user)}</strong> {describeEvent(e)}</p>
        <span className="shrink-0 text-xs text-muted-foreground">{ago(e.at, now)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 pl-11">
        {REACTIONS.map((emoji) => (
          <button key={emoji} type="button" onClick={() => toggle(emoji)} aria-pressed={mine.has(emoji)} aria-label={`Reagir com ${emoji}`}
            className={cn("inline-flex min-h-10 items-center gap-1 rounded-full border px-2.5 text-sm transition-[transform,background-color] active:scale-90",
              mine.has(emoji) ? "border-primary bg-primary-soft" : "border-border hover:bg-muted")}>
            <span aria-hidden>{emoji}</span>{(reactions[emoji] ?? 0) > 0 && <span className="text-xs font-bold tabular-nums">{reactions[emoji]}</span>}
          </button>
        ))}
      </div>
    </li>
  );
}
