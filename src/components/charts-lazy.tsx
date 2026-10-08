"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Recharts é pesado (~200 KB): os gráficos carregam depois do conteúdo principal. */
const loading = () => <Skeleton className="h-56 w-full" />;
export const AccuracyChart = dynamic(() => import("@/components/performance/accuracy-chart").then((m) => m.AccuracyChart), { ssr: false, loading });
export const TimeChart = dynamic(() => import("@/components/results/time-chart").then((m) => m.TimeChart), { ssr: false, loading });
export const EvolutionChart = dynamic(() => import("@/components/essay/evolution-chart").then((m) => m.EvolutionChart), { ssr: false, loading });
