import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuestionBank } from "@/components/question-bank";
import { requireAdmin } from "@/lib/auth";
import { parseFilters } from "@/lib/questions/queries";

export const metadata: Metadata = { title: "Questões (admin)" };

export default async function AdminQuestoesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const filters = parseFilters(await searchParams);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold md:text-3xl">Questões</h1>
        <Button asChild><Link href="/admin/importar">Importar</Link></Button>
      </header>
      <QuestionBank filters={filters} basePath="/admin/questoes" detailPath="/admin/questoes" admin />
    </div>
  );
}
