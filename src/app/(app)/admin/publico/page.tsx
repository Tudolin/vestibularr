import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { type DemoField, demoLabel } from "@/lib/demographics";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Público" };

type Bucket = { value: string; n: number | null };
type Summary = { students: number; answered: number } & Record<DemoField | "state", Bucket[]>;

const FIELDS: { key: DemoField | "state"; title: string }[] = [
  { key: "school_type", title: "Tipo de escola" },
  { key: "age_range", title: "Idade" },
  { key: "gender", title: "Gênero" },
  { key: "school_year", title: "Ano escolar" },
  { key: "state", title: "Estado" },
  { key: "referral", title: "Como conheceu" },
];

const label = (k: DemoField | "state", v: string) => v === "sem_resposta" ? "Sem resposta" : k === "state" ? v : demoLabel(k, v);

/** Quem são os alunos, em números agregados (respostas opcionais do "Sobre você"). Grupos com menos de 3 ficam ocultos. */
export default async function PublicoPage() {
  await requireAdmin();
  const { data } = await (await createClient()).rpc("demographics_summary");
  const s = data as Summary | null;
  if (!s) return <p className="text-muted-foreground">Aplique a migration 0019 para ver esta página.</p>;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold md:text-3xl">Público</h1>
        <p className="text-sm text-muted-foreground">
          {s.answered} de {s.students} alunos responderam o “Sobre você” (opcional). Só números gerais: grupos com menos de 3 pessoas aparecem como “poucos”.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {FIELDS.map(({ key, title }) => {
          const rows = (s[key] ?? []).filter((b) => b.value !== "sem_resposta");
          const blank = (s[key] ?? []).find((b) => b.value === "sem_resposta")?.n;
          const max = Math.max(1, ...rows.map((b) => b.n ?? 0));
          return (
            <Card key={key}>
              <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {rows.length === 0 && <p className="text-sm text-muted-foreground">Ainda sem respostas.</p>}
                {rows.map((b) => (
                  <div key={b.value} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3rem] items-center gap-2 text-sm">
                    <span className="truncate">{label(key, b.value)}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${((b.n ?? 0) / max) * 100}%` }} /></span>
                    <span className="text-right tabular-nums text-muted-foreground">{b.n ?? "poucos"}</span>
                  </div>
                ))}
                {blank != null && <p className="text-xs text-muted-foreground">{blank} sem resposta</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
