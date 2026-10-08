import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Estudar" };

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold md:text-3xl">Estudar</h1>
      <EmptyState icon={<BookOpen aria-hidden />} title="Em construção" description="Banco de questões, simulados e treino por disciplina chegam nas próximas fases." />
    </div>
  );
}
