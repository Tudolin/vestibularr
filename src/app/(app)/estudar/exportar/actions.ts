"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

const txt = z.string().trim().min(1).max(120);
const schema = z.object({
  source: z.enum(["banco", "erros", "tentativa"]),
  attempt_id: z.uuid().optional(),
  only_wrong: z.boolean().optional(),
  board: z.enum(["ENEM", "UFPR"]).optional(),
  areas: z.array(z.enum(["linguagens", "humanas", "natureza", "matematica"])).max(4).optional(),
  subjects: z.array(txt).max(30).optional(),
  year_from: z.number().int().min(1990).max(2100).optional(),
  year_to: z.number().int().min(1990).max(2100).optional(),
  language: z.enum(["ingles", "espanhol"]).optional(),
  count: z.number().int().min(1).max(200),
  order: z.enum(["assunto", "aleatoria"]),
  with_answers: z.boolean(),
  title: z.string().trim().max(80).optional(),
});

const MESSAGES: Record<string, string> = {
  "plan_limit:export": "Você já usou as exportações do seu plano neste mês. Baixar de novo uma lista já criada continua liberado.",
  no_questions: "Nenhuma questão com esses filtros. Tente ampliar a seleção.",
  no_errors: "Seu caderno de erros está vazio. Faça treinos e simulados primeiro.",
};

export async function createExportAction(input: unknown): Promise<ActionResult<string>> {
  await requireUser();
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: "Confira as opções escolhidas." };
  const { data, error } = await (await createClient()).rpc("export_create", { p: p.data });
  if (error) {
    const code = Object.keys(MESSAGES).find((k) => error.message.includes(k));
    return { ok: false, error: code ? MESSAGES[code] : "Não foi possível montar a lista. Tente de novo." };
  }
  revalidatePath("/estudar/exportar");
  return { ok: true, data: data as string };
}

/** Fez a lista no papel: cria um simulado sem cronômetro com as mesmas questões para lançar as respostas. */
export async function answerSheetAction(id: string): Promise<ActionResult<string>> {
  await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Lista inválida." };
  const { data, error } = await (await createClient()).rpc("export_to_attempt", { p_id: id });
  if (error) return { ok: false, error: "Não foi possível criar o cartão-resposta." };
  return { ok: true, data: data as string };
}

export async function deleteExportAction(id: string): Promise<ActionResult> {
  await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Lista inválida." };
  await (await createClient()).from("exports").delete().eq("id", id);
  revalidatePath("/estudar/exportar");
  return { ok: true };
}
