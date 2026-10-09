"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const txt = z.string().trim().min(1).max(120);
const startSchema = z.object({
  mode: z.enum(["simulado", "custom", "treino", "revisao"]),
  exam_id: z.uuid().optional(),
  title: z.string().trim().max(80).optional(),
  language: z.enum(["ingles", "espanhol"]).optional(),
  minutes: z.number().int().min(1).max(600).optional(),
  count: z.number().int().min(1).max(200).optional(),
  board: z.enum(["ENEM", "UFPR"]).optional(),
  areas: z.array(z.enum(["linguagens", "humanas", "natureza", "matematica"])).max(4).optional(),
  subjects: z.array(txt).max(30).optional(),
  topics: z.array(txt).max(60).optional(),
  work_id: z.uuid().optional(),
  year_from: z.number().int().min(1990).max(2100).optional(),
  year_to: z.number().int().min(1990).max(2100).optional(),
  kinds: z.array(z.enum(["objective", "discursive"])).max(2).optional(),
  quotas: z.record(txt, z.number().int().min(1).max(100)).optional(),
  discursive: z.number().int().min(0).max(10).optional(),
  retry_attempt: z.uuid().optional(),
  preset: z.string().max(40).optional(),
});

export type StartResult = { ok: true; id: string } | { ok: false; error: string; code?: "language_required" | "no_questions" | "no_errors_due" | "plan_limit:simulado" };

const MESSAGES: Record<string, string> = {
  language_required: "Escolha o idioma da língua estrangeira (inglês ou espanhol).",
  no_questions: "Nenhuma questão encontrada com esses filtros. Tente ampliar a seleção.",
  no_errors_due: "Você não tem erros para revisar agora. Volte quando houver revisões vencidas.",
  "plan_limit:simulado": "Seu plano Grátis inclui 1 simulado por prova por mês, e ele já foi usado. Treino, personalizado e revisão continuam liberados.",
};

/** Cria a tentativa no servidor (RPC security definer): é lá que as regras valem, não aqui. */
export async function startAttemptAction(input: unknown): Promise<StartResult> {
  await requireUser();
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira as opções escolhidas." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_attempt", { p: parsed.data });
  if (error) {
    const code = Object.keys(MESSAGES).find((k) => error.message.includes(k)) as keyof typeof MESSAGES | undefined;
    return { ok: false, error: code ? MESSAGES[code] : "Não foi possível iniciar. Tente novamente.", code: code as never };
  }
  return { ok: true, id: data as string };
}
