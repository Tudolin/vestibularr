"use client";

import { Check, Flame, MoreHorizontal, Search, Share2, UserPlus, Wind, X, Hand } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { friendRequestAction, friendRespondAction, reportAction, searchUsersAction, sendBoostAction } from "@/app/(app)/tripulacao/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NUDGES, type Card, type SearchCard } from "@/lib/social";
import { cn } from "@/lib/utils";
import { Avatar, handle } from "./avatar";
import { needsInternet } from "@/lib/use-online";

/** Compartilhar o link "me adiciona" (WhatsApp, Instagram… pelo menu nativo; senão copia). */
export function ShareInvite({ path, label = "Convidar amigos", text }: { path: string; label?: string; text: string }) {
  return (
    <Button variant="soft" onClick={async () => {
      const url = `${window.location.origin}${path}`;
      try {
        if (navigator.share) await navigator.share({ title: "Vestibularr", text, url });
        else { await navigator.clipboard.writeText(url); toast.success("Link copiado!"); }
      } catch { /* cancelado */ }
    }}>
      <Share2 aria-hidden /> {label}
    </Button>
  );
}

export function FriendSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchCard[]>([]);
  const [pending, start] = useTransition();
  const seq = useRef(0);
  useEffect(() => {
    const s = q.trim().replace(/^@/, "");
    if (s.length < 2) return;
    const n = ++seq.current;
    const id = window.setTimeout(async () => {
      const r = await searchUsersAction(s);
      if (n === seq.current) setRes(r);
    }, 250);
    return () => window.clearTimeout(id);
  }, [q]);
  const shown = q.trim().replace(/^@/, "").length >= 2 ? res : [];

  return (
    <div className="grid gap-2">
      <label className="relative block">
        <span className="sr-only">Buscar por @apelido</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por @apelido" className="pl-9" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      </label>
      {shown.length > 0 && (
        <ul className="stagger grid gap-1 rounded-card border border-border bg-card p-1">
          {shown.map((u) => (
            <li key={u.id} className="flex items-center gap-3 rounded-control p-2">
              <Avatar card={u} size="sm" />
              <span className="min-w-0 flex-1 truncate font-semibold">{handle(u)} <span className="text-xs font-normal text-muted-foreground">nível {u.level}</span></span>
              {u.relation === "accepted" ? <span className="text-xs font-semibold text-success">Amigos ✓</span>
                : u.relation === "pending" && u.requested_by_me ? <span className="text-xs text-muted-foreground">Pedido enviado</span>
                : (
                  <Button size="sm" disabled={pending} onClick={() => start(async () => {
      if (needsInternet("A Tripulação")) return;
                    const r = await friendRequestAction(u.username!);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success(r.data === "accepted" ? `Agora vocês são amigos! 🎉` : `Pedido enviado para ${handle(u)}`);
                    setRes((all) => all.map((x) => x.id === u.id ? { ...x, relation: r.data === "accepted" ? "accepted" : "pending", requested_by_me: true } : x));
                    router.refresh();
                  })}>
                    <UserPlus aria-hidden /> {u.relation === "pending" ? "Aceitar" : "Adicionar"}
                  </Button>
                )}
            </li>
          ))}
        </ul>
      )}
      {q.trim().replace(/^@/, "").length >= 2 && shown.length === 0 && <p className="px-1 text-sm text-muted-foreground">Ninguém com esse @apelido ainda.</p>}
    </div>
  );
}

export function IncomingRequest({ card }: { card: Card }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (a: "accept" | "decline") => start(async () => {
      if (needsInternet("A Tripulação")) return;
    const r = await friendRespondAction(card.id, a);
    if (!r.ok) toast.error(r.error);
    else if (a === "accept") toast.success(`Agora você e ${handle(card)} são amigos! 🎉`);
    router.refresh();
  });
  return (
    <li className="flex items-center gap-3 rounded-card border border-primary/40 bg-primary-soft/40 p-3">
      <Avatar card={card} size="sm" />
      <span className="min-w-0 flex-1 truncate text-sm"><strong>{handle(card)}</strong> quer ser seu amigo</span>
      <Button size="sm" disabled={pending} onClick={() => act("accept")} aria-label={`Aceitar ${handle(card)}`}><Check aria-hidden /> Aceitar</Button>
      <Button size="icon" variant="ghost" disabled={pending} onClick={() => act("decline")} aria-label={`Recusar ${handle(card)}`}><X aria-hidden /></Button>
    </li>
  );
}

/** Linha do ranking (amigos ou tripulação) com boosts e menu. */
export function FriendRow({ card, rank, isMe, ventoUsed, nudged, canRemove = true }: { card: Card; rank: number; isMe: boolean; ventoUsed: boolean; nudged: boolean; canRemove?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const boost = (kind: "vento" | "empurrao", message?: string) => start(async () => {
      if (needsInternet("A Tripulação")) return;
    const r = await sendBoostAction(card.id, kind, message);
    if (!r.ok) return void toast.error(r.error);
    toast.success(kind === "vento" ? `Vento a favor enviado! ${handle(card)} ganha +50% de XP por 15 min ⛵` : `Empurrão enviado para ${handle(card)} 👋`);
    setNudgeOpen(false);
    router.refresh();
  });
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <li className={cn("flex items-center gap-2 rounded-card p-2 sm:gap-3 sm:p-2.5", isMe ? "bg-primary-soft text-primary-soft-foreground" : "")}>
      <span className="w-5 shrink-0 text-center text-sm font-extrabold tabular-nums">{medal ?? rank}</span>
      <Avatar card={card} size="sm" />
      {/* XP fica sob o nome: a linha cabe em 360px mesmo com os botões de boost */}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{handle(card)}{isMe && " (você)"}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <strong className="text-foreground tabular-nums">{card.week_xp} XP</strong>
          <span>nv {card.level}</span>
          {card.streak > 0 && <span className="inline-flex items-center gap-0.5"><Flame className="size-3 text-[var(--area-humanas)]" aria-hidden />{card.streak}</span>}
        </span>
      </span>
      {!isMe && (
        <span className="flex shrink-0 items-center">
          <Button size="icon" variant="ghost" disabled={pending || ventoUsed} onClick={() => boost("vento")}
            aria-label={ventoUsed ? "Vento a favor já usado hoje" : `Mandar vento a favor para ${handle(card)}`} title="Vento a favor (+50% XP por 15 min)">
            <Wind aria-hidden />
          </Button>
          <Button size="icon" variant="ghost" disabled={pending || nudged} onClick={() => setNudgeOpen(true)} aria-label={nudged ? "Empurrão já enviado hoje" : `Dar um empurrão em ${handle(card)}`} title="Empurrão">
            <Hand aria-hidden />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setMenuOpen(true)} aria-label={`Mais opções para ${handle(card)}`}><MoreHorizontal aria-hidden /></Button>
        </span>
      )}

      <Dialog open={nudgeOpen} onOpenChange={setNudgeOpen}>
        <DialogContent>
          <DialogTitle>Empurrão para {handle(card)}</DialogTitle>
          <DialogDescription>Escolha a mensagem (1 por dia para cada amigo).</DialogDescription>
          <div className="grid gap-2">
            {NUDGES.map((m) => <Button key={m} variant="outline" size="lg" className="justify-start" disabled={pending} onClick={() => boost("empurrao", m)}>{m}</Button>)}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent>
          <DialogTitle>{handle(card)}</DialogTitle>
          <div className="grid gap-2">
            {canRemove && <Button variant="outline" size="lg" disabled={pending} onClick={() => start(async () => {
      if (needsInternet("A Tripulação")) return; await friendRespondAction(card.id, "remove"); setMenuOpen(false); router.refresh(); })}>Desfazer amizade</Button>}
            <Button variant="outline" size="lg" disabled={pending} onClick={() => start(async () => {
      if (needsInternet("A Tripulação")) return; await friendRespondAction(card.id, "block"); toast.success("Bloqueado."); setMenuOpen(false); router.refresh(); })}>Bloquear</Button>
            <p className="mt-2 text-sm font-semibold">Denunciar (também bloqueia)</p>
            {([["apelido", "Apelido ofensivo"], ["assedio", "Assédio"], ["spam", "Spam"], ["outro", "Outro motivo"]] as const).map(([r, l]) => (
              <Button key={r} variant="ghost" className="justify-start text-danger" disabled={pending}
                onClick={() => start(async () => {
      if (needsInternet("A Tripulação")) return; await reportAction(card.id, r); toast.success("Denúncia enviada. Obrigado por avisar."); setMenuOpen(false); router.refresh(); })}>{l}</Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </li>
  );
}
