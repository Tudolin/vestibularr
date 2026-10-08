import { BookMarked, ClipboardList, Database, Dumbbell, FileUp, RotateCcw, Settings2, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { dueErrorsCount, listOpenAttempts } from "@/lib/attempts/queries";

export const metadata: Metadata = { title: "Estudar" };

export default async function EstudarPage() {
  const [open, errors] = await Promise.all([listOpenAttempts(5), dueErrorsCount()]);
  const items: { href: string; title: string; desc: string; icon: LucideIcon; badge?: string }[] = [
    { href: "/estudar/simulados", title: "Simulados por prova", desc: "ENEM e UFPR no tempo oficial, com cronômetro.", icon: ClipboardList },
    { href: "/estudar/personalizado", title: "Simulado personalizado", desc: "Escolha disciplinas, assuntos, quantidade e tempo.", icon: Settings2 },
    { href: "/estudar/personalizado?modo=treino", title: "Treino", desc: "Questão a questão com gabarito na hora.", icon: Dumbbell },
    { href: "/estudar/erros", title: "Caderno de erros", desc: "Revise o que errou com repetição espaçada.", icon: RotateCcw, badge: errors.due > 0 ? `${errors.due} para revisar` : undefined },
    { href: "/estudar/questoes", title: "Banco de questões", desc: "Busque e filtre por vestibular, ano, área e obra.", icon: Database },
    { href: "/estudar/obras", title: "Obras literárias UFPR", desc: "Lista do ano e questões por obra.", icon: BookMarked },
    { href: "/estudar/enviar", title: "Enviar prova", desc: "Mande um arquivo de prova para o admin revisar.", icon: FileUp },
  ];
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold md:text-3xl">Estudar</h1>

      {open.length > 0 && (
        <section aria-labelledby="andamento" className="flex flex-col gap-3">
          <h2 id="andamento" className="text-lg font-bold">Em andamento</h2>
          <ul className="grid gap-2">
            {open.map((a) => (
              <li key={a.id}>
                <Card className="border-primary/40 transition-colors focus-within:border-primary hover:border-primary">
                  <Link href={`/prova/${a.id}`} className="flex items-center justify-between gap-3 rounded-card p-4">
                    <span>
                      <span className="block font-bold">{a.title}</span>
                      <span className="block text-sm text-muted-foreground">{a.answered} de {a.total} respondidas{a.status === "paused" ? " · pausada" : ""}</span>
                    </span>
                    <Badge tone="primary">Continuar</Badge>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map(({ href, title, desc, icon: Icon, badge }) => (
          <Card key={href} className="transition-colors focus-within:border-primary hover:border-primary">
            <Link href={href} className="flex items-center gap-4 rounded-card p-5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground"><Icon aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{title}</span>
                <span className="block text-sm text-muted-foreground">{desc}</span>
              </span>
              {badge && <Badge tone="warning">{badge}</Badge>}
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
