"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TriagemState } from "@/lib/triagem";
import { startAttemptAction } from "../estudar/actions";

const UUID = /^[0-9a-f-]{36}$/i;

/** Começa (ou retoma) a triagem. Sem cota no plano, volta para a introdução com o aviso. */
export async function startTriagemAction() {
  await requireUser();
  const { data, error } = await (await createClient()).rpc("triagem_start");
  if (error) redirect(error.message.includes("plan_limit:triagem") ? "/triagem?erro=limite" : "/triagem?erro=falha");
  redirect(`/triagem/${data}`);
}

/** "Pular, faço depois": guarda no perfil e segue para o início (o lembrete continua lá). */
export async function skipTriagemAction() {
  const user = await requireUser();
  await (await createClient()).from("profiles").update({ preferences: { ...user.preferences, triagem_skipped: true } }).eq("id", user.id);
  redirect("/inicio");
}

export type AnswerResult = { ok: true; state: TriagemState } | { ok: false; error: string };

/** Responde a questão atual (choice null = "não sei"). */
export async function answerTriagemAction(id: string, questionId: string, choice: string | null, ms: number): Promise<AnswerResult> {
  await requireUser();
  if (!UUID.test(id) || !UUID.test(questionId) || (choice !== null && !["A", "B", "C", "D", "E"].includes(choice))) return { ok: false, error: "Resposta inválida." };
  const { data, error } = await (await createClient()).rpc("triagem_answer", { p_attempt: id, p_question: questionId, p_choice: choice, p_ms: Math.max(0, Math.round(ms)) });
  if (error) {
    if (error.message.includes("not_current") || error.message.includes("triagem_finished")) return { ok: false, error: "Essa questão já foi respondida. Atualizando…" };
    return { ok: false, error: "Não foi possível salvar. Verifique a internet e tente de novo." };
  }
  revalidatePath(`/triagem/${id}`);
  return { ok: true, state: data as TriagemState };
}

/** Encerra antes do fim: o relatório usa o que já foi respondido. */
export async function finishTriagemAction(id: string) {
  await requireUser();
  if (!UUID.test(id)) return;
  await (await createClient()).rpc("triagem_finish", { p_attempt: id });
  redirect(`/triagem/${id}/relatorio`);
}

/** Treino com os assuntos de "Onde focar" (15 questões, gabarito na hora). */
export async function startFocusTreinoAction(topics: string[]) {
  const r = await startAttemptAction({ mode: "treino", board: "ENEM", topics: topics.slice(0, 5), count: 15, title: "Treino: onde focar" });
  redirect(r.ok ? `/prova/${r.id}` : "/estudar/personalizado?modo=treino");
}
