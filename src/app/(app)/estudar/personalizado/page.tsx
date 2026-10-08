import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { bankFacets } from "@/lib/attempts/queries";
import { CustomForm } from "./custom-form";

export const metadata: Metadata = { title: "Simulado personalizado e treino" };

export default async function PersonalizadoPage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const { modo } = await searchParams;
  const facets = await bankFacets();
  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start"><Link href="/estudar"><ArrowLeft aria-hidden /> Estudar</Link></Button>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold md:text-3xl">{modo === "treino" ? "Treino" : "Simulado personalizado"}</h1>
        <p className="text-muted-foreground">
          {modo === "treino" ? "Responda e veja o gabarito na hora, sem cronômetro." : "Escolha o que cair e quanto tempo tem. O gabarito aparece ao final."}
        </p>
      </header>
      <CustomForm facets={facets} initialMode={modo === "treino" ? "treino" : "custom"} />
    </div>
  );
}
