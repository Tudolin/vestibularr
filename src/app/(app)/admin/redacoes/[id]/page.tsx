import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CorrectionView, type Correction } from "@/components/essay/correction-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CommentForm } from "./comment-form";

export const metadata: Metadata = { title: "Redação (admin)" };

export default async function AdminRedacao({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: e } = await supabase
    .from("essays")
    .select("id, kind, status, user:profiles(full_name), theme:essay_themes(title), current:essay_versions!essays_current_version_fk(content)")
    .eq("id", id)
    .maybeSingle();
  if (!e) notFound();
  const { data: corrections } = await supabase
    .from("essay_corrections")
    .select("id, status, total, max_total, error, admin_comment, created_at, feedback, version:essay_versions(content)")
    .eq("essay_id", id)
    .order("created_at", { ascending: false });
  const list = (corrections ?? []) as unknown as (Correction & { version: { content: string } })[];

  return (
    <div className="flex flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="self-start"><Link href="/admin/redacoes"><ArrowLeft aria-hidden /> Redações</Link></Button>
      <header>
        <p className="text-sm text-muted-foreground">{(e.user as unknown as { full_name: string } | null)?.full_name}</p>
        <h1 className="text-xl font-extrabold md:text-2xl">{(e.theme as unknown as { title: string } | null)?.title}</h1>
        <Badge className="mt-2" tone="primary">{e.kind.toUpperCase()}</Badge>
      </header>
      {list.length === 0 ? (
        <Card className="p-5">
          <p className="mb-2 text-sm font-semibold text-muted-foreground">Rascunho atual (ainda não enviado)</p>
          <p className="whitespace-pre-wrap leading-8">{(e.current as unknown as { content: string } | null)?.content ?? "(vazio)"}</p>
        </Card>
      ) : (
        list.map((c, i) => (
          <section key={c.id} className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">{i === 0 ? "Correção mais recente" : `Correção anterior (${new Date(c.created_at).toLocaleDateString("pt-BR")})`}</h2>
            <CommentForm correctionId={c.id} initial={c.admin_comment ?? ""} />
            {c.status === "done" ? <CorrectionView c={c} text={c.version.content} /> : <Card className="p-4 text-sm">Status: {c.status}{c.error ? ` — ${c.error}` : ""}</Card>}
          </section>
        ))
      )}
    </div>
  );
}
