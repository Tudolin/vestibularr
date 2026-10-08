import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ExamRunner, type RunnerQuestion, type RunnerState } from "@/components/exam/runner";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Prova" };

export default async function ProvaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: state, error } = await supabase.rpc("attempt_state", { p_attempt: id });
  if (error || !state) notFound();
  if (state.attempt.status === "finished" || state.attempt.status === "expired") redirect(`/estudar/resultado/${id}`);

  const { data: rows } = await supabase
    .from("attempt_questions")
    .select("position, section, question:questions(id, number, year, area, subject, topic, kind, statement_md, images, language, alternatives(label, text_md, image_url))")
    .eq("attempt_id", id)
    .order("position");

  const questions: RunnerQuestion[] = (rows ?? []).map((r) => {
    const q = r.question as unknown as RunnerQuestion;
    return { ...q, section: r.section, alternatives: [...(q.alternatives ?? [])].sort((a, b) => a.label.localeCompare(b.label)) };
  });
  return <ExamRunner initial={state as RunnerState} questions={questions} />;
}
