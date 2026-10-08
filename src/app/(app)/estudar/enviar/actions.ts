"use server";

import { requireUser } from "@/lib/auth";
import { parseImportText } from "@/lib/import/parse";
import { createClient } from "@/lib/supabase/server";

const MAX_QUESTIONS = 200;
const MAX_CHARS = 2_000_000;

/** Aluno envia um arquivo para revisão: nada vai ao banco de questões até o admin aprovar. */
export async function submitImportAction(filename: string, text: string): Promise<{ ok: true; questions: number } | { ok: false; error: string }> {
  const user = await requireUser();
  if (typeof text !== "string" || text.length > MAX_CHARS) return { ok: false, error: "Arquivo grande demais (máx. ~2 MB)." };
  const res = parseImportText(String(filename).slice(0, 200), text);
  if (!res.bundle || res.summary.questions === 0) return { ok: false, error: res.issues[0]?.message ?? "Arquivo sem questões válidas." };
  if (res.summary.questions > MAX_QUESTIONS) return { ok: false, error: `Envie no máximo ${MAX_QUESTIONS} questões por vez.` };
  if (res.summary.invalid > 0) return { ok: false, error: `${res.summary.invalid} questão(ões) inválida(s). Corrija o arquivo e envie de novo.` };

  const supabase = await createClient();
  const { error } = await supabase.from("question_imports").insert({
    submitted_by: user.id,
    filename: String(filename).slice(0, 200),
    payload: res.bundle,
    summary: res.summary,
  });
  if (error) return { ok: false, error: "Não foi possível enviar. Tente novamente." };
  return { ok: true, questions: res.summary.questions };
}
