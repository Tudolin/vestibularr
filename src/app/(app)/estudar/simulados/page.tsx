import { ArrowLeft, ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listOpenAttempts } from "@/lib/attempts/queries";
import { BOARD_LABEL, BOARDS, LANGUAGES } from "@/lib/boards";
import { createClient } from "@/lib/supabase/server";
import { ExamCard, type ExamItem } from "./exam-card";

export const metadata: Metadata = { title: "Simulados" };

const NOTES: Record<string, string> = {
  UFPR: "Provas oficiais do Núcleo de Concursos (NC/UFPR), com o gabarito definitivo. A 1ª fase também é a prova do Cadete da PM-PR e do Corpo de Bombeiros do Paraná.",
  CONCURSO: "Provas de nível médio aplicadas pelo NC/UFPR. Português, raciocínio matemático, informática e legislação são comuns aos cargos; as específicas mudam por cargo.",
};

export default async function SimuladosPage() {
  const supabase = await createClient();
  const [{ data: exams }, { data: summaries }, open] = await Promise.all([
    supabase
      .from("exams")
      .select("id, name, year, pdf_url, board:exam_boards(code), format:exam_formats(structure), exam_questions(count)")
      .order("year", { ascending: false })
      .order("name"),
    supabase.rpc("exam_summaries"),
    listOpenAttempts(50),
  ]);
  const summary = new Map(((summaries ?? []) as { exam_id: string; questions: number; languages: string[] }[]).map((s) => [s.exam_id, s]));

  const items: ExamItem[] = (exams ?? [])
    .map((e) => ({
      id: e.id, name: e.name, year: e.year, pdf_url: e.pdf_url,
      board: (e.board as unknown as { code: string } | null)?.code ?? "",
      minutes: ((e.format as unknown as { structure?: { duration_minutes?: number } } | null)?.structure?.duration_minutes) ?? null,
      // sem a migration 0021 (exam_summaries), cai na contagem simples
      count: summary.get(e.id)?.questions ?? (e.exam_questions as unknown as { count: number }[])?.[0]?.count ?? 0,
      languages: LANGUAGES.filter((l) => summary.get(e.id)?.languages.includes(l)),
      openAttempt: open.find((a) => a.exam_id === e.id && a.mode === "simulado")?.id ?? null,
    }))
    .filter((e) => e.count > 0);

  const boards = BOARDS.map((b) => ({ board: b, list: items.filter((i) => i.board === b) })).filter((g) => g.list.length);

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
            <h2 id={`b-${board}`} className="flex items-center gap-2 text-lg font-bold">{board === "CONCURSO" ? "Concursos públicos" : BOARD_LABEL[board]} <Badge>{list.length} provas</Badge></h2>
            {NOTES[board] && <p className="-mt-1 text-sm text-muted-foreground">{NOTES[board]}</p>}
            <ul className="grid gap-3 md:grid-cols-2">
              {list.map((e) => <li key={e.id}><ExamCard exam={e} /></li>)}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
