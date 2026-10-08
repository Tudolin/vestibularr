import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ImportUploader } from "@/components/import-uploader";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { submitImportAction } from "./actions";

export const metadata: Metadata = { title: "Enviar prova" };

const TONE = { pending: "warning", approved: "success", rejected: "danger" } as const;
const LABEL = { pending: "Em análise", approved: "Aprovado", rejected: "Rejeitado" } as const;

export default async function EnviarPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("question_imports")
    .select("id, filename, status, review_note, summary, created_at")
    .eq("submitted_by", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start"><Link href="/estudar"><ArrowLeft aria-hidden /> Estudar</Link></Button>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold md:text-3xl">Enviar prova</h1>
        <p className="text-muted-foreground">Envie um arquivo .json ou .csv no formato do app. O admin revisa antes de entrar no banco de questões.</p>
      </header>
      <ImportUploader mode="student" submitFile={submitImportAction} />
      {mine && mine.length > 0 && (
        <section aria-labelledby="meus" className="flex flex-col gap-3">
          <h2 id="meus" className="text-lg font-bold">Meus envios</h2>
          <ul className="grid gap-2">
            {mine.map((m) => (
              <li key={m.id}>
                <Card className="flex flex-wrap items-center gap-2 p-4 text-sm">
                  <span className="font-semibold">{m.filename ?? "arquivo"}</span>
                  <Badge tone={TONE[m.status as keyof typeof TONE]}>{LABEL[m.status as keyof typeof LABEL]}</Badge>
                  <span className="text-muted-foreground">{(m.summary as { questions?: number })?.questions ?? 0} questões</span>
                  {m.review_note && <span className="w-full text-muted-foreground">Nota do admin: {m.review_note}</span>}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
