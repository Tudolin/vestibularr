import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { Scaled } from "@/components/scaled";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dica" };

export default async function DicaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) notFound();
  const { data: t } = await (await createClient()).from("tips").select("title, summary, body_md, updated_at").eq("slug", slug).maybeSingle();
  if (!t) notFound();
  return (
    <article className="flex flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="self-start"><Link href="/dicas"><ArrowLeft aria-hidden /> Dicas</Link></Button>
      <header>
        <h1 className="text-2xl font-extrabold md:text-3xl">{t.title}</h1>
        <p className="text-muted-foreground">{t.summary}</p>
      </header>
      <Card className="p-5 md:p-8">
        <Scaled><Markdown className="[&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:font-bold [&_li]:my-1 [&_table]:text-sm">{t.body_md}</Markdown></Scaled>
      </Card>
      <p className="text-xs text-muted-foreground">Atualizado em {new Date(t.updated_at).toLocaleDateString("pt-BR")}</p>
    </article>
  );
}
