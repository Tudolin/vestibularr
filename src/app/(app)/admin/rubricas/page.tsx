import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RubricEditor, type RubricRow } from "./rubric-editor";

export const metadata: Metadata = { title: "Rubricas" };

export default async function RubricasPage() {
  await requireAdmin();
  const { data } = await (await createClient()).from("rubrics").select("id, kind, name, version, criteria, instructions").eq("is_active", true).order("kind");
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold md:text-3xl">Rubricas de correção</h1>
        <p className="text-sm text-muted-foreground">Mudanças valem para as próximas correções, sem deploy. Cada salvamento cria uma nova versão (as correções antigas guardam a versão usada).</p>
      </header>
      {(data ?? []).map((r) => <RubricEditor key={r.id} rubric={r as RubricRow} />)}
    </div>
  );
}
