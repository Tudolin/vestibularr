"use client";

import { LazyMotion, m, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const loadMotion = () => import("framer-motion").then((mod) => mod.domAnimation);

type Kind = "in" | "hold" | "out";
type Step = { kind: Kind; label: string; s: number };
export const BREATH_PATTERNS = {
  calma: { name: "Calma", hint: "4-4-6 · baixa a ansiedade", steps: [{ kind: "in", label: "Inspire", s: 4 }, { kind: "hold", label: "Segure", s: 4 }, { kind: "out", label: "Solte", s: 6 }] },
  quadrada: { name: "Foco", hint: "4-4-4-4 · respiração quadrada", steps: [{ kind: "in", label: "Inspire", s: 4 }, { kind: "hold", label: "Segure", s: 4 }, { kind: "out", label: "Solte", s: 4 }, { kind: "hold", label: "Segure", s: 4 }] },
  sono: { name: "Relaxar", hint: "4-7-8 · antes de dormir ou da prova", steps: [{ kind: "in", label: "Inspire", s: 4 }, { kind: "hold", label: "Segure", s: 7 }, { kind: "out", label: "Solte", s: 8 }] },
} satisfies Record<string, { name: string; hint: string; steps: Step[] }>;
export type BreathPattern = keyof typeof BREATH_PATTERNS;

const CYCLES = 4;
// cores por etapa: mesmas variáveis do tema (funcionam no claro e no escuro)
const COLOR: Record<Kind, string> = { in: "var(--area-matematica)", hold: "var(--area-humanas)", out: "var(--area-natureza)" };
const PETALS = 6;

/** Onde estamos, a partir do instante de início (o relógio não "escorrega" se o celular travar um pouco). */
function locate(steps: Step[], elapsedMs: number) {
  const cycleMs = steps.reduce((a, s) => a + s.s * 1000, 0);
  const cycle = Math.floor(elapsedMs / cycleMs);
  let t = elapsedMs % cycleMs;
  for (let i = 0; i < steps.length; i++) {
    const d = steps[i].s * 1000;
    if (t < d) return { cycle, index: i, left: Math.ceil((d - t) / 1000), frac: t / d };
    t -= d;
  }
  return { cycle, index: 0, left: steps[0].s, frac: 0 };
}

/**
 * Respiração guiada: flor de pétalas que abre ao inspirar, brilha ao segurar e fecha ao soltar, com contagem,
 * anel de progresso e vibração leve na troca (Android). Com "reduzir movimento" ligado, fica só o texto e o anel.
 */
export function Breathing({ pattern, onPattern }: { pattern: BreathPattern; onPattern: (p: BreathPattern) => void }) {
  const reduce = useReducedMotion();
  const steps = BREATH_PATTERNS[pattern].steps as Step[];
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (startedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const pos = startedAt === null ? null : locate(steps, Math.max(0, now - startedAt));
  const finished = !!pos && pos.cycle >= CYCLES;
  const step = pos && !finished ? steps[pos.index] : null;

  // vibração curtinha a cada troca de etapa (só onde existe: Android/Chrome)
  const key = pos && !finished ? `${pos.cycle}-${pos.index}` : "idle";
  useEffect(() => {
    if (key === "idle") return;
    try { navigator.vibrate?.(25); } catch {}
  }, [key]);

  const start = () => { const t = Date.now(); setNow(t); setStartedAt(t); };
  const stop = () => setStartedAt(null);

  // geometria da flor: aberta ao inspirar/segurar depois de inspirar, fechada ao soltar
  const prevKind = pos && step ? steps[(pos.index + steps.length - 1) % steps.length].kind : "out";
  const open = step ? step.kind === "in" || (step.kind === "hold" && prevKind === "in") : false;
  const dur = step ? step.s : 0.6;
  const color = step ? COLOR[step.kind] : "var(--primary)";
  const r = 34;
  const ring = 2 * Math.PI * 70;
  const ringProgress = pos && step ? (pos.index + pos.frac) / steps.length : 0;

  return (
    <LazyMotion features={loadMotion} strict>
      <div className="flex flex-col items-center gap-4 py-1">
        <div className="flex flex-wrap justify-center gap-1 rounded-full bg-muted p-1" role="radiogroup" aria-label="Tipo de respiração">
          {(Object.keys(BREATH_PATTERNS) as BreathPattern[]).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={pattern === p} onClick={() => { onPattern(p); stop(); }}
              className={cn("min-h-9 rounded-full px-3 text-xs font-bold", pattern === p ? "bg-card shadow-sm" : "text-muted-foreground")}>
              {BREATH_PATTERNS[p].name}
            </button>
          ))}
        </div>

        <div className="relative flex size-48 items-center justify-center" aria-hidden>
          {/* anel de progresso do ciclo */}
          <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90">
            <circle cx="80" cy="80" r="70" fill="none" strokeWidth="4" className="stroke-muted" />
            <circle cx="80" cy="80" r="70" fill="none" strokeWidth="4" strokeLinecap="round" stroke={color}
              strokeDasharray={ring} strokeDashoffset={ring * (1 - ringProgress)} style={{ transition: "stroke-dashoffset 250ms linear, stroke 600ms ease" }} />
          </svg>
          {/* halo que pulsa ao segurar */}
          {!reduce && (
            <m.div className="absolute size-28 rounded-full blur-xl" style={{ background: color }}
              animate={{ opacity: step?.kind === "hold" ? [0.18, 0.38, 0.18] : open ? 0.28 : 0.1, scale: open ? 1.25 : 0.8 }}
              transition={step?.kind === "hold" ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : { duration: dur, ease: "easeInOut" }} />
          )}
          {/* pétalas */}
          {!reduce && (
            <m.div className="absolute size-full" animate={{ rotate: open ? 60 : 0 }} transition={{ duration: dur, ease: "easeInOut" }}>
              {Array.from({ length: PETALS }, (_, i) => {
                const a = (i / PETALS) * 2 * Math.PI;
                return (
                  <m.span key={i} className="absolute left-1/2 top-1/2 -ml-8 -mt-8 size-16 rounded-full mix-blend-multiply dark:mix-blend-screen"
                    style={{ background: color, opacity: 0.55 }}
                    animate={{ x: Math.cos(a) * (open ? r : 14), y: Math.sin(a) * (open ? r : 14), scale: open ? 1 : 0.7 }}
                    transition={{ duration: dur, ease: "easeInOut" }} />
                );
              })}
            </m.div>
          )}
          {/* centro: etapa e contagem */}
          <div className="relative flex size-16 flex-col items-center justify-center rounded-full bg-card/90 shadow-sm backdrop-blur">
            <span className="text-xs font-bold">{finished ? "Pronto ✨" : step ? step.label : "Respire"}</span>
            {step && <span className="font-display text-xl font-extrabold leading-none tabular-nums">{pos!.left}</span>}
          </div>
        </div>

        {/* leitor de tela: só anuncia a troca de etapa */}
        <p className="sr-only" aria-live="polite">{finished ? "Exercício concluído" : step ? `${step.label} por ${step.s} segundos` : ""}</p>
        <p className="text-sm text-muted-foreground">
          {finished ? "Muito bem. Volte quando quiser." : pos ? `Ciclo ${pos.cycle + 1} de ${CYCLES}` : BREATH_PATTERNS[pattern].hint}
        </p>
        <Button variant={startedAt !== null && !finished ? "soft" : "primary"} onClick={startedAt !== null && !finished ? stop : start}>
          {startedAt !== null && !finished ? "Parar" : finished ? "De novo" : "Começar"}
        </Button>
      </div>
    </LazyMotion>
  );
}
