import { PenLine } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Redação" };

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold md:text-3xl">Redação</h1>
      <EmptyState icon={<PenLine aria-hidden />} title="Em construção" description="Redação ENEM e produção textual UFPR com correção por IA chegam na Fase 4." />
    </div>
  );
}
