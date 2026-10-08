"use client";

import { m } from "framer-motion";
import { Check, Strikethrough, X } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

export type AltState = "idle" | "selected" | "correct" | "wrong" | "missed";

/**
 * Alternativa grande (≥56px). Selecionar = toque/clique. Riscar = toque longo, clique direito
 * ou o botão ao lado (acessível por teclado: Shift+letra também).
 */
export function Alternative({
  label, html, image, state, struck, disabled, onSelect, onStrike,
}: {
  /** html: texto da alternativa já sanitizado no servidor */
  label: string; html: string; image?: string | null; state: AltState; struck: boolean; disabled?: boolean;
  onSelect: () => void; onStrike: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const cancel = () => timer.current && clearTimeout(timer.current);

  const tone =
    state === "correct" ? "border-success bg-success-soft text-success-soft-foreground"
    : state === "wrong" ? "border-danger bg-danger-soft text-danger-soft-foreground"
    : state === "missed" ? "border-success border-dashed bg-card"
    : state === "selected" ? "border-primary bg-primary-soft text-primary-soft-foreground"
    : "border-border bg-card hover:border-primary";

  return (
    <m.li
      animate={state === "wrong" ? { x: [0, -8, 8, -5, 5, 0] } : state === "correct" ? { scale: [1, 1.025, 1] } : {}}
      transition={{ duration: 0.4 }}
      className={cn("flex min-h-14 items-stretch rounded-card border-2", tone, struck && state === "idle" && "opacity-60")}
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={state === "selected" || state === "correct" || state === "wrong"}
        aria-label={`Alternativa ${label}${struck ? " (riscada)" : ""}`}
        onClick={() => { if (longPressed.current) { longPressed.current = false; return; } onSelect(); }}
        onContextMenu={(e) => { e.preventDefault(); onStrike(); }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          longPressed.current = false;
          timer.current = setTimeout(() => { longPressed.current = true; onStrike(); navigator.vibrate?.(15); }, 450);
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        className="flex min-w-0 flex-1 touch-manipulation items-start gap-3 rounded-l-card px-4 py-3 text-left disabled:cursor-default"
      >
        <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", state === "idle" ? "bg-muted text-foreground" : "bg-card text-foreground")}>{label}</span>
        <span className={cn("min-w-0 flex-1", struck && "line-through decoration-2")}>
          {html && <div className="text-base [&_p]:whitespace-pre-line" dangerouslySetInnerHTML={{ __html: html }} />}
          {image && (
            // eslint-disable-next-line @next/next/no-img-element -- figura externa da prova
            <img src={image} alt={`Figura da alternativa ${label}`} loading="lazy" className="mt-1 max-h-48 rounded-control bg-white" />
          )}
        </span>
        {state === "correct" && <Check className="mt-1 size-6 shrink-0" aria-label="Correta" />}
        {state === "wrong" && <X className="mt-1 size-6 shrink-0" aria-label="Errada" />}
      </button>
      <button
        type="button"
        onClick={onStrike}
        aria-label={`${struck ? "Desfazer" : "Riscar"} alternativa ${label}`}
        className="flex w-11 shrink-0 items-center justify-center rounded-r-card text-muted-foreground hover:text-foreground"
      >
        <Strikethrough className="size-4" aria-hidden />
      </button>
    </m.li>
  );
}
