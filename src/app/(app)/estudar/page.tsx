import { BookMarked, Database, FileUp, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Estudar" };

const ITEMS: { href: string; title: string; desc: string; icon: LucideIcon }[] = [
  { href: "/estudar/questoes", title: "Banco de questões", desc: "Busque e filtre por vestibular, ano, área e obra.", icon: Database },
  { href: "/estudar/obras", title: "Obras literárias UFPR", desc: "Lista do ano e questões por obra.", icon: BookMarked },
  { href: "/estudar/enviar", title: "Enviar prova", desc: "Mande um arquivo de prova para o admin revisar.", icon: FileUp },
];

export default function EstudarPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold md:text-3xl">Estudar</h1>
      <p className="text-muted-foreground">Simulados e treino com feedback chegam na próxima fase. Por enquanto, explore o banco.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {ITEMS.map(({ href, title, desc, icon: Icon }) => (
          <Card key={href} className="transition-colors focus-within:border-primary hover:border-primary">
            <Link href={href} className="flex items-center gap-4 rounded-card p-5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <Icon aria-hidden />
              </span>
              <span>
                <span className="block font-bold">{title}</span>
                <span className="block text-sm text-muted-foreground">{desc}</span>
              </span>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
