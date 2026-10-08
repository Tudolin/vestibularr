"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { aiConfigured, AiError, generateJson } from "@/lib/ai/gemini";
import { requeueJob, runAiJob } from "@/lib/ai/jobs";
import { TRANSCRIBE_SYSTEM } from "@/lib/ai/prompts";
import { transcriptionSchema } from "@/lib/ai/schemas";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type R<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const MSG: Record<string, string> = {
  quota_exceeded: "Você atingiu o limite diário de correções por IA. Amanhã tem mais!",
  texto_vazio: "Escreva a redação antes de enviar.",
  essay_submitted: "Esta redação já foi enviada.",
  sem_respostas: "Não há respostas discursivas para corrigir.",
  "tentativa em andamento": "Finalize a prova antes de pedir a correção.",
};
const friendly = (m: string, fallback: string) => Object.entries(MSG).find(([k]) => m.includes(k))?.[1] ?? fallback;
const NOT_CONFIGURED = "A correção por IA ainda não foi configurada pelo administrador (chave do Gemini).";

export async function startEssayAction(themeId: string): Promise<R<string>> {
  await requireUser();
  if (!z.uuid().safeParse(themeId).success) return { ok: false, error: "Tema inválido." };
  const { data, error } = await (await createClient()).rpc("start_essay", { p_theme: themeId });
  if (error) return { ok: false, error: "Não foi possível abrir a redação." };
  return { ok: true, data: data as string };
}

/** Congela a versão atual, reserva cota e dispara a correção depois da resposta (after). */
export async function submitEssayAction(essayId: string): Promise<R<{ jobId: string }>> {
  await requireUser();
  if (!z.uuid().safeParse(essayId).success) return { ok: false, error: "Redação inválida." };
  if (!aiConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const { data, error } = await (await createClient()).rpc("submit_essay", { p_essay: essayId });
  if (error) return { ok: false, error: friendly(error.message, "Não foi possível enviar.") };
  const jobId = (data as { job_id: string }).job_id;
  after(() => runAiJob(jobId));
  revalidatePath(`/redacao/${essayId}`);
  return { ok: true, data: { jobId } };
}

export async function retryJobAction(jobId: string): Promise<R> {
  const user = await requireUser();
  if (!z.uuid().safeParse(jobId).success) return { ok: false, error: "Inválido." };
  if (!aiConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const quota = (await (await createClient()).rpc("ai_quota")).data as { limit: number; used: number; unlimited: boolean } | null;
  if (quota && !quota.unlimited && quota.used >= quota.limit) return { ok: false, error: MSG.quota_exceeded };
  const r = await requeueJob(jobId, user.id);
  if (!r.ok) return { ok: false, error: r.error ?? "Não foi possível tentar de novo." };
  after(() => runAiJob(jobId));
  return { ok: true, data: undefined };
}

export async function reopenEssayAction(essayId: string): Promise<R> {
  await requireUser();
  if (!z.uuid().safeParse(essayId).success) return { ok: false, error: "Inválido." };
  const { error } = await (await createClient()).rpc("reopen_essay", { p_essay: essayId });
  if (error) return { ok: false, error: "Não foi possível reabrir." };
  revalidatePath(`/redacao/${essayId}`);
  return { ok: true, data: undefined };
}

/** Correção em lote das discursivas de uma prova (1 cota por pedido). */
export async function requestDiscursiveAction(attemptId: string, questionIds?: string[]): Promise<R<{ jobId: string }>> {
  await requireUser();
  if (!z.uuid().safeParse(attemptId).success || (questionIds && !z.array(z.uuid()).max(20).safeParse(questionIds).success)) return { ok: false, error: "Inválido." };
  if (!aiConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const { data, error } = await (await createClient()).rpc("request_discursive_feedback", { p_attempt: attemptId, p_questions: questionIds ?? null });
  if (error) return { ok: false, error: friendly(error.message, "Não foi possível pedir a correção.") };
  const jobId = data as string;
  after(() => runAiJob(jobId));
  return { ok: true, data: { jobId } };
}

const photoSchema = z.object({
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(100).max(4_000_000), // ~3 MB de imagem; o cliente reduz antes de enviar
});

/** Foto → texto (síncrono, ~10–30 s). O aluno revisa antes de usar. Consome 1 da cota. */
export async function transcribePhotoAction(input: unknown): Promise<R<{ text: string; illegible: string[]; confidence: string }>> {
  await requireUser();
  const p = photoSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Imagem inválida ou grande demais." };
  if (!aiConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const supabase = await createClient();
  const { data: jobId, error } = await supabase.rpc("reserve_transcription");
  if (error) return { ok: false, error: friendly(error.message, "Não foi possível transcrever.") };
  const admin = createAdminClient();
  await admin.from("ai_jobs").update({ status: "running", started_at: new Date().toISOString(), attempts: 1 }).eq("id", jobId);
  try {
    const { value, model } = await generateJson({
      system: TRANSCRIBE_SYSTEM,
      parts: [{ text: "Transcreva a redação desta foto." }, { inline_data: { mime_type: p.data.mime, data: p.data.base64 } }],
      schema: transcriptionSchema,
      timeoutMs: 50_000,
    });
    await admin.from("ai_jobs").update({ status: "done", finished_at: new Date().toISOString(), model }).eq("id", jobId);
    return { ok: true, data: value };
  } catch (e) {
    const msg = e instanceof AiError ? e.message : "Falha na transcrição.";
    await admin.from("ai_jobs").update({ status: "failed", finished_at: new Date().toISOString(), error: msg }).eq("id", jobId);
    return { ok: false, error: `${msg} (não contou na sua cota)` };
  }
}
