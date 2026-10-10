"use client";

import { m, LazyMotion, domAnimation, useReducedMotion } from "framer-motion";
import { Flame, Shield } from "lucide-react";

const SPARKS = ["🔥", "⭐", "🎉", "⚓", "✨", "🔥", "⭐", "🎉"];

/** Comemoração no resultado do desafio do dia (com fagulhas; sem animação se o aluno pediu menos movimento). */
export function DailyDone({ streak, shields, correct, total }: { streak: number; shields: number; correct: number; total: number }) {
  const still = useReducedMotion();
  return (
    <LazyMotion features={domAnimation}>
      <m.div initial={still ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="relative overflow-hidden rounded-card border-2 border-success/50 bg-success-soft p-5 text-success-soft-foreground">
        {!still && SPARKS.map((s, i) => (
          <m.span key={i} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 text-xl"
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
            animate={{ x: Math.cos((i / SPARKS.length) * Math.PI * 2) * 140, y: Math.sin((i / SPARKS.length) * Math.PI * 2) * 70, opacity: 0, scale: 1.2 }}
            transition={{ duration: 1.1, delay: 0.15, ease: "easeOut" }}>{s}</m.span>
        ))}
        <p className="text-lg font-extrabold">Desafio do dia concluído! 🎉</p>
        <p className="text-sm">{correct}/{total} acertos · +30 XP de bônus</p>
        <p className="mt-2 flex flex-wrap gap-4 text-sm font-bold">
          <span className="inline-flex items-center gap-1"><Flame className="size-4 text-orange-500" aria-hidden /> {streak} {streak === 1 ? "dia seguido" : "dias seguidos"}</span>
          <span className="inline-flex items-center gap-1"><Shield className="size-4" aria-hidden /> {shields}/2 escudos</span>
        </p>
        {streak > 0 && streak % 7 !== 0 && <p className="mt-1 text-xs">Faltam {7 - (streak % 7)} dias para ganhar um escudo de sequência.</p>}
        {streak > 0 && streak % 7 === 0 && <p className="mt-1 text-xs font-bold">Você ganhou um escudo de sequência! 🛡️</p>}
      </m.div>
    </LazyMotion>
  );
}
