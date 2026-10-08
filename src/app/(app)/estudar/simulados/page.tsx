import { ArrowLeft, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listOpenAttempts } from "@/lib/attempts/queries";
import { createClient } from "@/lib/supabase/server";
import { ExamCard, type ExamItem } from "./exam-card";

export const metadata: Metadata = { title: "Simulados" };

export default async function SimuladosPage() {
  const supabase = await createClient();
  const [{ data: exams }, open] = await Promise.all([
    supabase
      .from("exams")
      .select("id, name, year, pdf_url, board:exam_boards(code), format:exam_formats(structure), exam_questions(count)")
      .order("year", { ascending: false })
      .order("name"),
    listOpenAttempts(50),
  ]);

  const items: ExamItem[] = (exams ?? [])
    .map((e) => ({
      id: e.id, name: e.name, year: e.year, pdf_url: e.pdf_url,
      board: (e.board as unknown as { code: string } | null)?.code ?? "",
      minutes: ((e.format as unknown as { structure?: { duration_minutes?: number } } | null)?.structure?.duration_minutes) ?? null,
      count: (e.exam_questions as unknown as { count: number }[])?.[0]?.count ?? 0,
      openAttempt: open.find((a) => a.exam_id === e.id && a.mode === "simulado")?.id ?? null,
    }))
    .filter((e) => e.count > 0);

  const boards = ["ENEM", "UFPR"].map((b) => ({ board: b, list: items.filter((i) => i.board === b) })).filter((g) => g.list.length);

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start"><Link href="/estudar"><ArrowLeft aria-hidden /> Estudar</Link></Button>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold md:text-3xl">Simulados por prova</h1>
        <p className="text-muted-foreground">Prova completa, no tempo oficial. O cronômetro roda no servidor: você pode continuar em outro aparelho.</p>
      </header>
      {boards.length === 0 ? (
        <EmptyState icon={<ClipboardList aria-hidden />} title="Nenhuma prova disponível" description="O administrador ainda não importou provas." />
      ) : (
        boards.map(({ board, list }) => (
          <section key={board} aria-labelledby={`b-${board}`} className="flex flex-col gap-3">
            <h2 id={`b-${board}`} className="flex items-center gap-2 text-lg font-bold">{board} <Badge>{list.length} provas</Badge></h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {list.map((e) => <li key={e.id}><ExamCard exam={e} /></li>)}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
