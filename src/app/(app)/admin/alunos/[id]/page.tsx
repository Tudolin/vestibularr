import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoardFilter } from "@/components/performance/board-filter";
import { PerformanceDashboard } from "@/components/performance/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Aluno (admin)" };
const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function AdminAluno({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vestibular?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { vestibular } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const board = vestibular === "ENEM" || vestibular === "UFPR" ? vestibular : null;
  const supabase = await createClient();
  const [{ data: p }, { data: logs }, { data: attempts }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", id).maybeSingle(),
    supabase.from("access_logs").select("event, path, device, at").eq("user_id", id).order("at", { ascending: false }).limit(30),
    supabase.from("exam_attempts").select("id, title, mode, status, score, finished_at, started_at").eq("user_id", id).order("started_at", { ascending: false }).limit(15),
  ]);
  if (!p) notFound();
  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start"><Link href="/admin"><ArrowLeft aria-hidden /> Visão geral</Link></Button>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold md:text-3xl">{p.full_name || p.email}</h1><p className="text-sm text-muted-foreground">{p.email}</p></div>
        <BoardFilter base={`/admin/alunos/${id}`} board={board} />
      </header>
      <PerformanceDashboard userId={id} board={board} editable={false} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Simulados e treinos</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm">
              {(attempts ?? []).map((a) => {
                const s = a.score as { correct: number; total: number } | null;
                return (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2">
                    <span>{a.title} <span className="text-xs text-muted-foreground">({a.mode})</span></span>
                    <span className="font-semibold">{s ? `${s.correct}/${s.total}` : a.status === "in_progress" ? "em andamento" : a.status}</span>
                  </li>
                );
              })}
              {(attempts ?? []).length === 0 && <li className="text-muted-foreground">Nenhuma tentativa.</li>}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Últimos acessos</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {(logs ?? []).map((l, i) => (
                <li key={i} className="flex justify-between gap-2"><span>{l.event === "login" ? "🔑 login" : l.path}</span><span className="text-xs text-muted-foreground">{l.device ?? ""} · {fmt.format(new Date(l.at))}</span></li>
              ))}
              {(logs ?? []).length === 0 && <li className="text-muted-foreground">Nenhum acesso registrado.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
