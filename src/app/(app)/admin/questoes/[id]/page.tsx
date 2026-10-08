import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { getQuestion } from "@/lib/questions/queries";
import { createClient } from "@/lib/supabase/server";
import { QuestionEditor } from "./editor";

export const metadata: Metadata = { title: "Editar questão" };

export default async function EditarQuestaoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getQuestion(id, true);
  if (!data) notFound();
  const supabase = await createClient();
  const { data: works } = await supabase.from("literary_works").select("id, title").order("title");
  const { q, key } = data;
  return (
    <div className="flex flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="self-start"><Link href="/admin/questoes"><ArrowLeft aria-hidden /> Questões</Link></Button>
      <h1 className="text-2xl font-extrabold md:text-3xl">Editar questão</h1>
      <p className="text-sm text-muted-foreground">{q.board?.name} · {q.exam?.name ?? "avulsa"} {q.number != null && `· Q${q.number}`}</p>
      <QuestionEditor
        works={works ?? []}
        initial={{
          id: q.id, area: q.area ?? "", subject: q.subject ?? "", topic: q.topic ?? "", work_id: q.work?.id ?? "", is_active: q.is_active,
          statement_md: q.statement_md, kind: q.kind,
          alternatives: (q.alternatives ?? []).map((a: { label: string; text_md: string }) => ({ label: a.label, text_md: a.text_md })),
          correct: key?.correct_label ?? "", explanation_md: key?.explanation_md ?? "", official_mirror_md: key?.official_mirror_md ?? "",
        }}
      />
    </div>
  );
}
