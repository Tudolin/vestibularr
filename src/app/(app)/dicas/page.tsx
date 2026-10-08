import { Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dicas" };

export default async function DicasPage() {
  const { data } = await (await createClient()).from("tips").select("slug, title, summary, category").order("sort").order("title");
  const groups = new Map<string, typeof data>();
  (data ?? []).forEach((t) => groups.set(t.category, [...(groups.get(t.category) ?? []), t]));
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold md:text-3xl">Dicas e estrutura</h1>
        <p className="text-muted-foreground">Guias curtos para consultar antes de escrever ou fazer prova.</p>
      </header>
      {(data ?? []).length === 0 && <EmptyState icon={<Lightbulb aria-hidden />} title="Nenhuma dica publicada" />}
      {[...groups.entries()].map(([cat, list]) => (
        <section key={cat} aria-labelledby={`c-${cat}`} className="flex flex-col gap-3">
          <h2 id={`c-${cat}`} className="text-lg font-bold">{cat}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {list!.map((t) => (
              <li key={t.slug}>
                <Card className="h-full transition-colors focus-within:border-primary hover:border-primary">
                  <Link href={`/dicas/${t.slug}`} className="flex h-full flex-col gap-1 rounded-card p-5">
                    <span className="font-bold">{t.title}</span>
                    <span className="text-sm text-muted-foreground">{t.summary}</span>
                    <Badge className="mt-2 self-start">{cat}</Badge>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
