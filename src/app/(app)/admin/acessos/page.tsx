import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Log de acessos" };
const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" });

export default async function AcessosPage({ searchParams }: { searchParams: Promise<{ aluno?: string; tipo?: string }> }) {
  await requireAdmin();
  const { aluno, tipo } = await searchParams;
  const supabase = await createClient();
  const { data: people } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
  let q = supabase.from("access_logs").select("id, user_id, event, path, device, user_agent, at").order("at", { ascending: false }).limit(300);
  if (aluno && /^[0-9a-f-]{36}$/i.test(aluno)) q = q.eq("user_id", aluno);
  if (tipo === "login") q = q.eq("event", "login");
  const { data: logs } = await q;
  const name = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email]));
  const link = (o: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ aluno, tipo, ...o }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold md:text-3xl">Log de acessos</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={link({ aluno: undefined })} className={cn("rounded-full border px-3 py-1.5", !aluno ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border")}>Todos</Link>
        {(people ?? []).map((p) => <Link key={p.id} href={link({ aluno: p.id })} className={cn("rounded-full border px-3 py-1.5", aluno === p.id ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border")}>{p.full_name || p.email}</Link>)}
        <span className="mx-1 text-muted-foreground">|</span>
        <Link href={link({ tipo: tipo === "login" ? undefined : "login" })} className={cn("rounded-full border px-3 py-1.5", tipo === "login" ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border")}>Só logins</Link>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Quando</th><th className="p-3">Quem</th><th className="p-3">Evento</th><th className="p-3">Página</th><th className="p-3">Aparelho</th></tr></thead>
          <tbody>
            {(logs ?? []).map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="p-3 whitespace-nowrap">{fmt.format(new Date(l.at))}</td>
                <td className="p-3">{name.get(l.user_id) ?? "—"}</td>
                <td className="p-3">{l.event === "login" ? "login" : "página"}</td>
                <td className="p-3">{l.path ?? "—"}</td>
                <td className="p-3" title={l.user_agent ?? ""}>{l.device ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(logs ?? []).length === 0 && <p className="p-4 text-sm text-muted-foreground">Nada registrado ainda.</p>}
      </Card>
    </div>
  );
}
