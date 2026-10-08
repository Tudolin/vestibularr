import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Desempenho" };

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold md:text-3xl">Desempenho</h1>
      <EmptyState icon={<BarChart3 aria-hidden />} title="Em construção" description="Evolução, pontos fortes e fracos e nota estimada chegam na Fase 5." />
    </div>
  );
}
