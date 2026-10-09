import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuestionBank } from "@/components/question-bank";
import { requireAdmin } from "@/lib/auth";
import { parseFilters } from "@/lib/questions/queries";
import { createClient } from "@/lib/supabase/server";
import { OnlySolvedToggle } from "./only-solved-toggle";

export const metadata: Metadata = { title: "Questões (admin)" };

export default async function AdminQuestoesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const filters = parseFilters(await searchParams);
  const supabase = await createClient();
  const [setting, solved, total] = await Promise.all([
    supabase.from("settings").select("value").eq("key", "only_solved_questions").maybeSingle(),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("is_active", true).eq("has_solution", true),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold md:text-3xl">Questões</h1>
        <Button asChild><Link href="/admin/importar">Importar</Link></Button>
      </header>
      <OnlySolvedToggle initial={setting.data?.value !== false} solved={solved.count ?? 0} total={total.count ?? 0} />
      <QuestionBank filters={filters} basePath="/admin/questoes" detailPath="/admin/questoes" admin />
    </div>
  );
}
