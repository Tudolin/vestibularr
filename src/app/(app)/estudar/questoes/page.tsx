import type { Metadata } from "next";
import { QuestionBank } from "@/components/question-bank";
import { parseFilters } from "@/lib/questions/queries";

export const metadata: Metadata = { title: "Banco de questões" };

export default async function QuestoesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold md:text-3xl">Banco de questões</h1>
      <QuestionBank filters={filters} basePath="/estudar/questoes" detailPath="/estudar/questoes" />
    </div>
  );
}
