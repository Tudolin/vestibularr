import { BookOpen, Lightbulb, PenLine, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { excerpt } from "@/components/markdown";
import { areaBadge } from "@/components/question-view";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Busca" };

/** Busca global: questões (texto completo em português), temas de redação e dicas. */
export default async function BuscaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw } = await searchParams;
  const q = (raw ?? "").trim().slice(0, 100);
  let questions: { id: string; area: string | null; year: number | null; statement_md: string }[] = [];
  let themes: { id: string; title: string; kind: string; year: number | null }[] = [];
  let tips: { slug: string; title: string; summary: string }[] = [];
  let totalQ = 0;
  if (q.length >= 2) {
    const supabase = await createClient();
    // Texto do usuário vai para um filtro do PostgREST: remove o que tem significado na sintaxe (, ( ) . * % _ \ aspas).
    const safe = q.replace(/[,().*%_\\"'`]/g, " ").replace(/\s+/g, " ").trim();
    const like = `%${safe}%`;
    const [qq, tt, dd] = await Promise.all([
      supabase.from("questions").select("id, area, year, statement_md", { count: "exact" }).textSearch("search", q, { type: "websearch", config: "portuguese" }).order("year", { ascending: false, nullsFirst: false }).limit(10),
      supabase.from("essay_themes").select("id, title, kind, year").ilike("title", like).limit(10),
      supabase.from("tips").select("slug, title, summary").or(`title.ilike.${like},summary.ilike.${like},body_md.ilike.${like}`).limit(10),
    ]);
    questions = qq.data ?? [];
    totalQ = qq.count ?? 0;
    themes = tt.data ?? [];
    tips = dd.data ?? [];
  }
  const nothing = q.length >= 2 && !questions.length && !themes.length && !tips.length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold md:text-3xl">Busca</h1>
      <form action="/busca" className="flex gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Ex.: fotossíntese, Revolução Francesa, conectivos" aria-label="Buscar questões, temas e dicas" autoFocus />
        <Button type="submit" aria-label="Buscar"><Search aria-hidden /></Button>
      </form>
      {q.length > 0 && q.length < 2 && <p className="text-sm text-muted-foreground">Digite ao menos 2 letras.</p>}
      {nothing && <EmptyState icon={<Search aria-hidden />} title="Nada encontrado" description="Tente outra palavra ou um termo mais geral." />}
      {questions.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="r-q">
          <h2 id="r-q" className="flex items-center gap-2 font-bold"><BookOpen className="size-4" aria-hidden /> Questões ({totalQ})</h2>
          {questions.map((x) => (
            <Card key={x.id}><Link href={`/estudar/questoes/${x.id}`} className="flex flex-col gap-1 rounded-card p-4"><span className="flex gap-2">{areaBadge(x.area)}{x.year && <Badge>{x.year}</Badge>}</span><span className="text-sm">{excerpt(x.statement_md, 180)}</span></Link></Card>
          ))}
          {totalQ > 10 && <Link className="text-sm font-semibold text-primary underline" href={`/estudar/questoes?q=${encodeURIComponent(q)}`}>Ver todas no banco de questões</Link>}
        </section>
      )}
      {themes.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="r-t">
          <h2 id="r-t" className="flex items-center gap-2 font-bold"><PenLine className="size-4" aria-hidden /> Temas de redação</h2>
          {themes.map((t) => <Card key={t.id}><Link href={`/redacao?tipo=${t.kind}`} className="flex items-center gap-2 rounded-card p-4"><Badge tone="primary">{t.kind.toUpperCase()}</Badge><span className="text-sm font-semibold">{t.title}</span>{t.year && <Badge>{t.year}</Badge>}</Link></Card>)}
        </section>
      )}
      {tips.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="r-d">
          <h2 id="r-d" className="flex items-center gap-2 font-bold"><Lightbulb className="size-4" aria-hidden /> Dicas</h2>
          {tips.map((t) => <Card key={t.slug}><Link href={`/dicas/${t.slug}`} className="flex flex-col rounded-card p-4"><span className="font-semibold">{t.title}</span><span className="text-sm text-muted-foreground">{t.summary}</span></Link></Card>)}
        </section>
      )}
    </div>
  );
}
