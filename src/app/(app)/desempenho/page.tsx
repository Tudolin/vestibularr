import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardFilter } from "@/components/performance/board-filter";
import { PerformanceDashboard } from "@/components/performance/dashboard";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Desempenho" };

export default async function DesempenhoPage({ searchParams }: { searchParams: Promise<{ vestibular?: string }> }) {
  const { vestibular } = await searchParams;
  const board = vestibular === "ENEM" || vestibular === "UFPR" ? vestibular : null;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-extrabold md:text-3xl">Desempenho</h1>
        <BoardFilter base="/desempenho" board={board} />
      </header>
      <Suspense key={board ?? "all"} fallback={<DashboardSkeleton />}>
        <PerformanceDashboard userId={null} board={board} editable />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Carregando desempenho">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-72" />
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
    </div>
  );
}
