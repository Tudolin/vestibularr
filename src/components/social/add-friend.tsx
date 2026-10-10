"use client";

import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { friendRequestAction } from "@/app/(app)/tripulacao/actions";
import { Button } from "@/components/ui/button";
import type { SearchCard } from "@/lib/social";
import { needsInternet } from "@/lib/use-online";

export function AddFriendButton({ card }: { card: SearchCard }) {
  const [rel, setRel] = useState(card.relation === "pending" && card.requested_by_me ? "sent" : card.relation);
  const [pending, start] = useTransition();
  if (rel === "accepted") return <Button asChild><Link href="/tripulacao">Vocês já são amigos — ver ranking</Link></Button>;
  if (rel === "sent") return <p className="text-sm font-semibold text-muted-foreground">Pedido enviado ✓</p>;
  return (
    <Button size="lg" disabled={pending} onClick={() => start(async () => {
      if (needsInternet("A Tripulação")) return;
      const r = await friendRequestAction(card.username!);
      if (!r.ok) return void toast.error(r.error);
      setRel(r.data === "accepted" ? "accepted" : "sent");
      toast.success(r.data === "accepted" ? "Agora vocês são amigos! 🎉" : "Pedido enviado!");
    })}>
      <UserPlus aria-hidden /> {card.relation === "pending" ? "Aceitar amizade" : "Adicionar amigo"}
    </Button>
  );
}
