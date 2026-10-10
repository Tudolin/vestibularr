import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { JoinCrew } from "@/components/social/crew-forms";
import { NeedsUsername } from "@/components/social/needs-username";

export const metadata: Metadata = { title: "Entrar na tripulação" };

/** Link de convite da tripulação: confirma antes de entrar (nada acontece só por abrir o link). */
export default async function JoinCrewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Entrar na tripulação 🏴‍☠️</h1>
      <p className="text-muted-foreground">Te chamaram para estudar junto! Confira o código e toque em Entrar.</p>
      <NeedsUsername><Card><CardContent className="pt-6"><JoinCrew initialCode={code.toUpperCase().slice(0, 8)} /></CardContent></Card></NeedsUsername>
    </div>
  );
}
