"use server";

import { startAttemptAction } from "@/app/(app)/estudar/actions";
import { listOpenAttempts } from "@/lib/attempts/queries";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const BASE = ["/inicio", "/estudar", "/estudar/erros", "/redacao", "/desempenho", "/dicas", "/guia", "/perfil"];

export type OfflineManifest = { urls: string[]; attempts: number; essays: number; results: number; pack: string | null; packError?: string };

/**
 * Lista do que baixar para estudar sem internet: telas principais, provas em andamento,
 * redações (rascunhos e correções para revisar), últimos resultados e, se pedido, um treino novo de 20 questões.
 */
export async function offlineManifestAction(withPack: boolean): Promise<OfflineManifest> {
  await requireUser();
  const supabase = await createClient();
  let pack: string | null = null;
  let packError: string | undefined;
  if (withPack) {
    const r = await startAttemptAction({ mode: "treino", count: 20, title: `Treino offline · ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}` });
    if (r.ok) pack = r.id; else packError = r.error;
  }
  const [open, essays, results] = await Promise.all([
    listOpenAttempts(10),
    supabase.from("essays").select("id").order("updated_at", { ascending: false }).limit(10),
    supabase.from("exam_attempts").select("id").eq("status", "finished").neq("mode", "triagem").order("updated_at", { ascending: false }).limit(5),
  ]);
  const prova = [...new Set([...(pack ? [pack] : []), ...open.map((a) => a.id)])].map((id) => `/prova/${id}`);
  const red = (essays.data ?? []).map((e) => `/redacao/${e.id}`);
  const res = (results.data ?? []).map((a) => `/estudar/resultado/${a.id}`);
  return { urls: [...BASE, ...prova, ...red, ...res], attempts: prova.length, essays: red.length, results: res.length, pack, packError };
}
