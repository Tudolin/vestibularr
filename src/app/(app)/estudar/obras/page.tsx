import { BookMarked } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Obras literárias UFPR" };

export default async function ObrasPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano } = await searchParams;
  const year = Number(ano) || null;
  const supabase = await createClient();
  const [{ data: works }, { data: counts }] = await Promise.all([
    supabase.from("literary_works").select("id, title, author, year_from, year_to, notes").order("title"),
    supabase.from("questions").select("work_id").not("work_id", "is", null),
  ]);
  const n = new Map<string, number>();
  counts?.forEach((c) => n.set(c.work_id!, (n.get(c.work_id!) ?? 0) + 1));
  const years = [...new Set((works ?? []).flatMap((w) => [w.year_from, w.year_to]).filter((y): y is number => y != null))].sort((a, b) => b - a);
  const list = (works ?? []).filter((w) => !year || ((w.year_from ?? -Infinity) <= year && year <= (w.year_to ?? Infinity)));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold md:text-3xl">Obras literárias UFPR</h1>
        <p className="text-muted-foreground">Lista mantida pelo administrador. Toque numa obra para ver as questões.</p>
      </header>
      {years.length > 0 && (
        <form className="flex items-end gap-2" method="get">
          <label className="grid gap-1 text-sm font-medium">
            Vestibular de
            <select name="ano" defaultValue={year ?? ""} className="h-11 rounded-control border border-input bg-card px-3 text-base md:text-sm">
              <option value="">Todas</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button className="h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground">Aplicar</button>
        </form>
      )}
      {list.length === 0 ? (
        <EmptyState icon={<BookMarked aria-hidden />} title="Nenhuma obra cadastrada" description="O administrador ainda não publicou a lista de obras do ano." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((w) => (
            <li key={w.id}>
              <Card className="lift focus-within:border-primary hover:border-primary">
                <Link href={`/estudar/questoes?work=${w.id}`} className="flex flex-col gap-1 rounded-card p-4">
                  <span className="font-bold">{w.title}</span>
                  {w.author && <span className="text-sm text-muted-foreground">{w.author}</span>}
                  <span className="mt-1 flex flex-wrap gap-2">
                    <Badge tone="primary">{n.get(w.id) ?? 0} questões</Badge>
                    {(w.year_from || w.year_to) && <Badge>{w.year_from ?? "…"}–{w.year_to ?? "…"}</Badge>}
                  </span>
                  {w.notes && <span className="mt-1 text-sm text-muted-foreground">{w.notes}</span>}
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
