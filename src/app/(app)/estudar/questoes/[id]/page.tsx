import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuestionView, areaBadge } from "@/components/question-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getQuestion } from "@/lib/questions/queries";

export const metadata: Metadata = { title: "Questão" };

export default async function QuestaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getQuestion(id, isAdmin);
  if (!data) notFound();
  const { q, key } = data;

  return (
    <div className="flex flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/estudar/questoes"><ArrowLeft aria-hidden /> Voltar ao banco</Link>
      </Button>
      <header className="flex flex-wrap items-center gap-2">
        <Badge>{q.board?.code}</Badge>
        {q.year && <Badge>{q.year}</Badge>}
        {areaBadge(q.area)}
        {q.number != null && <span className="text-sm font-semibold text-muted-foreground">Questão {q.number}</span>}
        {q.language && <Badge tone="primary">{q.language === "ingles" ? "Inglês" : "Espanhol"}</Badge>}
        {q.work && <Badge tone="primary">{q.work.title}</Badge>}
        {q.exam?.name && <span className="text-sm text-muted-foreground">{q.exam.name}</span>}
      </header>
      <QuestionView statement={q.statement_md} alternatives={q.alternatives ?? []} correct={key?.correct_label} explanation={key?.explanation_md} mirror={key?.official_mirror_md} />
      <div className="flex flex-wrap gap-2">
        {q.exam?.pdf_url && (
          <Button asChild variant="outline"><a href={q.exam.pdf_url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden /> PDF da prova</a></Button>
        )}
        {isAdmin && <Button asChild variant="soft"><Link href={`/admin/questoes/${q.id}`}>Editar (admin)</Link></Button>}
      </div>
      {!isAdmin && <p className="text-sm text-muted-foreground">O gabarito e a resolução aparecem no treino e no simulado, depois que você responde.</p>}
    </div>
  );
}
