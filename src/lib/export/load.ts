import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ExportContent } from "./types";

/** Conteúdo da lista (RPC só devolve se for do aluno logado). */
export async function loadExport(id: string): Promise<ExportContent | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await (await createClient()).rpc("export_content", { p_id: id });
  return (data as ExportContent | null) ?? null;
}
