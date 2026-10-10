import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Baixar meus dados (LGPD): tudo que é do aluno, lido com a sessão dele (o RLS garante que só sai o que é dele).
 * Não inclui senha nem dados de outros alunos (amigos aparecem só pelo @apelido).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const pick = async (table: string, col = "user_id") => ((await supabase.from(table).select("*").eq(col, user.id)).data ?? []) as Record<string, unknown>[];
  const attempts = await pick("exam_attempts");
  const ids = attempts.map((a) => String(a.id));
  const answers = ids.length ? (await supabase.from("attempt_answers").select("attempt_id, question_id, choice, discursive_text, time_spent_ms, answered_at").in("attempt_id", ids)).data ?? [] : [];
  const essays = await pick("essays");
  const essayIds = essays.map((e) => String(e.id));
  const corrections = essayIds.length ? (await supabase.from("essay_corrections").select("*").in("essay_id", essayIds)).data ?? [] : [];
  const versions = essayIds.length ? (await supabase.from("essay_versions").select("*").in("essay_id", essayIds)).data ?? [] : [];
  const { data: social } = await supabase.rpc("social_overview");
  const body = {
    exportado_em: new Date().toISOString(),
    conta: { id: user.id, email: user.email, criado_em: user.created_at },
    perfil: (await supabase.from("profiles").select("full_name, username, avatar, role, target_boards, target_courses, preferences, created_at").eq("id", user.id).maybeSingle()).data,
    assinatura: (await supabase.from("subscriptions").select("plan_code, status, provider, current_period_end, trial_end, created_at").eq("user_id", user.id).maybeSingle()).data,
    metas: await pick("student_goals"),
    tentativas: attempts,
    respostas: answers,
    caderno_de_erros: await pick("error_notebook"),
    redacoes: essays,
    versoes_das_redacoes: versions,
    correcoes: corrections,
    conquistas: await pick("achievements"),
    xp: await pick("xp_events"),
    social: social ?? null,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="vestibularr-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
