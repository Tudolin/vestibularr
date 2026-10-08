import type { Metadata } from "next";
import { ImportUploader } from "@/components/import-uploader";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { importChunkAction } from "./actions";
import { PendingList, type PendingRow } from "./pending-list";

export const metadata: Metadata = { title: "Importar provas" };

export default async function ImportarPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("question_imports")
    .select("id, filename, summary, created_at, submitter:profiles!question_imports_submitted_by_fkey(full_name, email)")
    .eq("status", "pending")
    .order("created_at");
  const rows: PendingRow[] = (data ?? []).map((r) => {
    const s = r.submitter as unknown as { full_name: string; email: string | null } | null;
    return { id: r.id, filename: r.filename ?? "arquivo", questions: (r.summary as { questions?: number })?.questions ?? 0, exams: (r.summary as { exams?: number })?.exams ?? 0, by: s?.full_name || s?.email || "aluno", at: r.created_at };
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold md:text-3xl">Importar provas</h1>
        <p className="text-muted-foreground">JSON ou CSV. Você vê a prévia e os erros antes de gravar. Reimportar atualiza as questões existentes em vez de duplicar.</p>
        <p className="text-sm text-muted-foreground">Formato: <a className="font-medium text-primary underline" href="/exemplo-importacao.json" download>exemplo.json</a> · <a className="font-medium text-primary underline" href="/exemplo-importacao.csv" download>exemplo.csv</a></p>
      </header>
      <ImportUploader mode="admin" importChunk={importChunkAction} />
      <PendingList rows={rows} />
    </div>
  );
}
