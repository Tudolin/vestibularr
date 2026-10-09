import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { GUIDE_PREF } from "@/lib/guide";
import { GuidePlayer } from "./guide-player";

export const metadata: Metadata = { title: "Guia" };

export default async function GuiaPage() {
  const user = await requireUser();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold md:text-3xl">Guia do Vestibularr</h1>
        <p className="text-muted-foreground">Tour de 2 minutos pelo app. Toque num capítulo para pular direto para ele.</p>
      </header>
      <GuidePlayer showOnLogin={user.preferences[GUIDE_PREF] !== true} />
    </div>
  );
}
