import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddFriendButton } from "@/components/social/add-friend";
import { NeedsUsername } from "@/components/social/needs-username";
import { Avatar, handle } from "@/components/social/avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { SearchCard } from "@/lib/social";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Adicionar amigo" };

/** Link "me adiciona" (/amigo/@apelido): mostra o cartão e o botão de adicionar. */
export default async function AddFriendPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const u = decodeURIComponent(username).replace(/^@/, "").toLowerCase();
  const { data } = await (await createClient()).rpc("social_search", { p_q: u });
  const card = ((data ?? []) as SearchCard[]).find((c) => c.username === u);
  if (!card) notFound();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Bora estudar junto? ⚓</h1>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <Avatar card={card} size="lg" />
          <p className="text-xl font-extrabold">{handle(card)}</p>
          <p className="text-sm text-muted-foreground">Nível {card.level} · {card.week_xp} XP nesta semana{card.streak ? ` · 🔥 ${card.streak} dias` : ""}</p>
          <NeedsUsername><AddFriendButton card={card} /></NeedsUsername>
        </CardContent>
      </Card>
    </div>
  );
}
