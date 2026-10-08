import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ExamsTable, type ExamRow } from "./exams-table";

export const metadata: Metadata = { title: "Provas" };

export default async function ProvasPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("exams")
    .select("id, name, year, pdf_url, answer_pdf_url, is_published, board:exam_boards(code), format:exam_formats(code), exam_questions(count)")
    .order("year", { ascending: false })
    .order("name");
  const rows: ExamRow[] = (data ?? []).map((e) => ({
    id: e.id, name: e.name, year: e.year, pdf_url: e.pdf_url, answer_pdf_url: e.answer_pdf_url, is_published: e.is_published,
    board: (e.board as unknown as { code: string } | null)?.code ?? "",
    format: (e.format as unknown as { code: string } | null)?.code ?? null,
    count: (e.exam_questions as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold md:text-3xl">Provas</h1>
        <p className="text-sm text-muted-foreground">As provas são criadas pela importação. Aqui você cola os links dos PDFs originais e publica ou oculta.</p>
      </header>
      <ExamsTable rows={rows} />
    </div>
  );
}
