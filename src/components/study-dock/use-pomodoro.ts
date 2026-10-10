"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { nextPhase, PHASE_LABEL, phaseMs, type Phase, type StudyTools } from "@/lib/study-tools";

/**
 * Estado do pomodoro no aparelho (localStorage): sobrevive a troca de página, recarregar e fechar a aba,
 * e fica igual entre abas abertas. Guardamos o instante de término, não um contador: o tempo não "para"
 * quando o celular bloqueia a tela.
 */
type Saved = { phase: Phase; done: number; endsAt: number | null; remaining: number; day: string; today: number };
const KEY = "vr:pomodoro";
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

function load(t: StudyTools): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
    if (s && typeof s.remaining === "number") return s.day === today() ? s : { ...s, day: today(), today: 0 };
  } catch {}
  return { phase: "focus", done: 0, endsAt: null, remaining: phaseMs("focus", t), day: today(), today: 0 };
}
function save(s: Saved) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function usePomodoro(tools: StudyTools, onPhaseEnd: (ended: Phase, next: Phase) => void) {
  const [state, setState] = useState<Saved | null>(null); // null até montar (sem localStorage no servidor)
  const [now, setNow] = useState(0);
  const toolsRef = useRef(tools);
  const endRef = useRef(onPhaseEnd);
  useEffect(() => { toolsRef.current = tools; endRef.current = onPhaseEnd; });

  const commit = useCallback((s: Saved) => { save(s); setState(s); }, []);

  // carrega e acompanha outras abas
  useEffect(() => {
    const read = () => { setState(load(toolsRef.current)); setNow(Date.now()); };
    read();
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) read(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // relógio: 1 tique por segundo só quando está rodando
  const running = !!state?.endsAt;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // fim da etapa (também cobre "voltei depois de horas": avança uma vez e para, sem disparar várias)
  useEffect(() => {
    if (!state?.endsAt || now < state.endsAt) return;
    const t = toolsRef.current;
    const n = nextPhase(state.phase, state.done, t);
    const dur = phaseMs(n.phase, t);
    const late = now - state.endsAt > 60_000; // ficou fora muito tempo: não emenda sozinho
    const auto = t.autoStart && !late;
    commit({
      phase: n.phase, done: n.done, remaining: dur,
      endsAt: auto ? now + dur : null,
      day: today(), today: (state.day === today() ? state.today : 0) + (state.phase === "focus" ? 1 : 0),
    });
    endRef.current(state.phase, n.phase);
  }, [now, state, commit]);

  // parado: se a duração diminuiu nos ajustes, o restante acompanha
  const remaining = !state ? phaseMs("focus", tools) : state.endsAt ? Math.max(0, state.endsAt - now) : Math.min(state.remaining, phaseMs(state.phase, tools));

  const start = useCallback(() => {
    setState((s) => {
      if (!s || s.endsAt) return s;
      const t = Date.now();
      const next = { ...s, endsAt: t + Math.min(s.remaining, phaseMs(s.phase, toolsRef.current)) };
      save(next);
      setNow(t);
      return next;
    });
  }, []);
  const pause = useCallback(() => {
    setState((s) => {
      if (!s?.endsAt) return s;
      const next = { ...s, remaining: Math.max(0, s.endsAt - Date.now()), endsAt: null };
      save(next);
      return next;
    });
  }, []);
  const reset = useCallback((phase?: Phase) => {
    setState((s) => {
      const p = phase ?? s?.phase ?? "focus";
      const next: Saved = { phase: p, done: s?.done ?? 0, endsAt: null, remaining: phaseMs(p, toolsRef.current), day: today(), today: s?.day === today() ? s.today : 0 };
      save(next);
      return next;
    });
  }, []);

  return {
    ready: !!state,
    phase: state?.phase ?? "focus",
    label: PHASE_LABEL[state?.phase ?? "focus"],
    running,
    remaining,
    total: phaseMs(state?.phase ?? "focus", tools),
    done: state?.done ?? 0,
    today: state?.day === today() ? state.today : 0,
    start, pause, reset,
  };
}
