import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ExamRunner, type RunnerQuestion, type RunnerState } from "@/components/exam/runner";
import { markdownToHtml } from "@/lib/markdown-html";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Prova" };

export default async function ProvaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: state, error } = await supabase.rpc("attempt_state", { p_attempt: id });
  if (error || !state) notFound();
  if (state.attempt.mode === "triagem") redirect(`/triagem/${id}`);
  if (state.attempt.status === "finished" || state.attempt.status === "expired") redirect(`/estudar/resultado/${id}`);

  const { data: rows } = await supabase
    .from("attempt_questions")
    .select("position, section, question:questions(id, number, year, area, subject, kind, statement_md, images, language, alternatives(label, text_md, image_url))")
    .eq("attempt_id", id)
    .order("position");

  const questions: RunnerQuestion[] = (rows ?? []).map((r) => {
    const q = r.question as unknown as Omit<RunnerQuestion, "alternatives" | "statement_html" | "extra_images" | "line_limit"> & { statement_md: string; images: string[]; alternatives: { label: string; text_md: string; image_url: string | null }[] };
    // Markdown vira HTML sanitizado aqui no servidor: o celular não baixa nem executa o parser.
    const { statement_md, images, ...rest } = q;
    return {
      ...rest,
      section: r.section,
      statement_html: markdownToHtml(statement_md),
      // só o necessário vai ao cliente: imagens que o markdown não mostra e o limite de linhas
      extra_images: (images ?? []).filter((u) => !statement_md.includes(u)),
      line_limit: Number(statement_md.match(/at[ée]\s+(\d{1,2})\s+linhas/i)?.[1]) || null,
      alternatives: [...(q.alternatives ?? [])].sort((a, b) => a.label.localeCompare(b.label)).map((a) => ({ label: a.label, html: a.text_md ? markdownToHtml(a.text_md) : "", image_url: a.image_url })),
    };
  });
  return <ExamRunner initial={state as RunnerState} questions={questions} />;
}
