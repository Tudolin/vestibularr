import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EssayEditor } from "@/components/essay/editor";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { aiConfigured } from "@/lib/ai/gemini";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Redação" };
// Envio para correção e transcrição de foto chamam a IA nesta página (Vercel: até 60 s).
export const maxDuration = 60;

export default async function EssayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: essay } = await supabase
    .from("essays")
    .select("id, status, kind, current_version_id, theme:essay_themes(*), current:essay_versions!essays_current_version_fk(content, client_ts)")
    .eq("id", id)
    .maybeSingle();
  if (!essay) notFound();
  const [{ data: versions }, { data: quota }, { data: now }] = await Promise.all([
    supabase.from("essay_versions").select("id, created_at, device, is_submission, source, content").eq("essay_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.rpc("ai_quota"),
    supabase.rpc("server_time_ms"),
  ]);
  const theme = essay.theme as unknown as { title: string; prompt_md: string; support_texts_md: string | null; line_limit: number; min_lines: number; max_score: number; kind: string; year: number | null; genre: string | null };
  const cur = essay.current as unknown as { content: string; client_ts: number } | null;

  return (
    <div className="flex flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="self-start"><Link href={`/redacao?tipo=${essay.kind}`}><ArrowLeft aria-hidden /> Redação</Link></Button>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge tone="primary">{essay.kind === "enem" ? "ENEM" : "UFPR"}</Badge>
          {theme.year && <Badge>{theme.year}</Badge>}
          {theme.genre && <Badge tone="warning">{theme.genre}</Badge>}
          <Badge>até {theme.line_limit} linhas · {Number(theme.max_score).toLocaleString("pt-BR")} pts</Badge>
        </div>
        <h1 className="text-xl font-extrabold leading-snug md:text-2xl">{theme.title}</h1>
      </header>
      <details className="group rounded-card border border-border bg-card" open={essay.status === "draft"}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 font-semibold">Proposta e textos de apoio</summary>
        <div className="grid gap-3 border-t border-border p-4">
          <Markdown className="text-base">{theme.prompt_md}</Markdown>
          {theme.support_texts_md && <Card className="bg-muted p-4"><Markdown className="text-base">{theme.support_texts_md}</Markdown></Card>}
        </div>
      </details>
      <EssayEditor
        key={`${essay.current_version_id}-${essay.status}`}
        essay={{ id: essay.id, status: essay.status, kind: essay.kind }}
        theme={{ line_limit: theme.line_limit, min_lines: theme.min_lines }}
        initial={{ content: cur?.content ?? "", client_ts: Number(cur?.client_ts ?? 0), server_now: Number(now ?? 0) }}
        versions={(versions ?? []).map((v) => ({ id: v.id, created_at: v.created_at, device: v.device, is_submission: v.is_submission, source: v.source, length: v.content.length }))}
        quota={(quota as { limit: number; used: number; unlimited: boolean }) ?? { limit: 5, used: 0, unlimited: false }}
        aiReady={aiConfigured()}
      />
    </div>
  );
}
