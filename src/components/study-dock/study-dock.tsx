"use client";

import { Headphones, NotebookPen, Pause, Play, RotateCcw, Settings2, Timer, Wind, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { NOTES_MAX, fmtClock, PHASE_LABEL, readTools, type Phase, type StudyTools } from "@/lib/study-tools";
import { cn } from "@/lib/utils";
import { saveStudyNotesAction, saveStudyToolsAction } from "./actions";
import { usePomodoro } from "./use-pomodoro";
import { chime, useNoise } from "./use-noise";

type Tab = "foco" | "som" | "notas" | "respirar" | "ajustes";
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "foco", label: "Pomodoro", icon: <Timer aria-hidden /> },
  { id: "som", label: "Som", icon: <Headphones aria-hidden /> },
  { id: "notas", label: "Notas", icon: <NotebookPen aria-hidden /> },
  { id: "respirar", label: "Respirar", icon: <Wind aria-hidden /> },
  { id: "ajustes", label: "Ajustes", icon: <Settings2 aria-hidden /> },
];
const OPEN_KEY = "vr:dock-aberto";
const TAB_KEY = "vr:dock-aba";
const NOTES_KEY = "vr:notas";

/**
 * Painel flutuante de estudo, presente em todas as páginas: pomodoro, som ambiente, anotações e respiração.
 * Ajustes e anotações vão para o perfil (próxima sessão, qualquer aparelho); o relógio fica no aparelho.
 */
export function StudyDock({ initialTools, initialNotes, context = "app" }: { initialTools: unknown; initialNotes: string; context?: "app" | "exam" }) {
  const [tools, setTools] = useState<StudyTools>(() => readTools(initialTools));
  const panelId = useId();
  // painel aberto (nesta aba do navegador) e última ferramenta usada (no aparelho)
  const [openRaw, setOpenRaw] = useStored("session", OPEN_KEY);
  const [tabRaw, setTabRaw] = useStored("local", TAB_KEY);
  const open = openRaw === "1";
  const tab: Tab = TABS.some((x) => x.id === tabRaw) ? (tabRaw as Tab) : "foco";
  const toggle = useCallback((v: boolean) => setOpenRaw(v ? "1" : "0"), [setOpenRaw]);
  const pick = (t: Tab) => setTabRaw(t);

  // ajustes: aplica na hora e salva no perfil com um pequeno atraso (vários cliques = 1 gravação)
  const saveTimer = useRef<number | null>(null);
  const [saved, setSaved] = useState<"idle" | "saving" | "ok" | "erro">("idle");
  const update = useCallback((patch: Partial<StudyTools>) => {
    setTools((prev) => {
      const next = { ...prev, ...patch };
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      setSaved("saving");
      saveTimer.current = window.setTimeout(async () => {
        const r = await saveStudyToolsAction(next);
        setSaved(r.ok ? "ok" : "erro");
      }, 800);
      return next;
    });
  }, []);

  const onPhaseEnd = useCallback((ended: Phase, next: Phase) => {
    if (tools.chime) chime();
    try { navigator.vibrate?.([120, 80, 120]); } catch {}
    if (tools.notify && typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(ended === "focus" ? "Foco concluído! 🎉" : "Pausa encerrada", {
          body: ended === "focus" ? `Hora da ${PHASE_LABEL[next].toLowerCase()}.` : "Bora voltar ao foco.",
          icon: "/icons/icon-192.png", tag: "vr-pomodoro",
        });
      } catch {}
    }
  }, [tools.chime, tools.notify]);
  const pomo = usePomodoro(tools, onPhaseEnd);
  const noise = useNoise(tools.noise, tools.volume);

  // Esc fecha
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") toggle(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, toggle]);

  const side = tools.side === "left" ? "left-4" : "right-4";
  const progress = pomo.total ? 1 - pomo.remaining / pomo.total : 0;

  return (
    <div className={cn("fixed z-40 flex flex-col gap-2 print:hidden", side, tools.side === "left" ? "items-start" : "items-end",
      // acima da barra inferior: a do app some no md, a da prova só no lg
      context === "exam" ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6" : "bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6")}>
      {open && (
        <section id={panelId} role="dialog" aria-label="Ferramentas de estudo"
          className="flex max-h-[min(34rem,calc(100dvh-10rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-card border border-border bg-card shadow-xl">
          <header className="flex items-center justify-between border-b border-border px-4 py-2">
            <p className="font-bold">Ferramentas de estudo</p>
            <button type="button" onClick={() => toggle(false)} aria-label="Fechar" className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"><X className="size-4" aria-hidden /></button>
          </header>
          <div role="tablist" aria-label="Ferramenta" className="grid grid-cols-5 border-b border-border">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => pick(t.id)}
                className={cn("flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-semibold [&_svg]:size-4",
                  tab === t.id ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                {t.icon}<span className="max-w-full truncate">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="overflow-y-auto p-4">
            {tab === "foco" && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex gap-1 rounded-full bg-muted p-1" role="radiogroup" aria-label="Etapa">
                  {(["focus", "short", "long"] as Phase[]).map((p) => (
                    <button key={p} type="button" role="radio" aria-checked={pomo.phase === p} onClick={() => pomo.reset(p)}
                      className={cn("min-h-9 rounded-full px-3 text-xs font-bold", pomo.phase === p ? "bg-card shadow-sm" : "text-muted-foreground")}>
                      {PHASE_LABEL[p]}
                    </button>
                  ))}
                </div>
                <Ring progress={progress} phase={pomo.phase}>
                  <span className="font-display text-4xl font-extrabold tabular-nums" aria-live="off">{fmtClock(pomo.remaining)}</span>
                  <span className="text-xs text-muted-foreground">{pomo.label}</span>
                </Ring>
                <div className="flex gap-2">
                  {pomo.running
                    ? <Button onClick={pomo.pause}><Pause aria-hidden /> Pausar</Button>
                    : <Button onClick={pomo.start} disabled={!pomo.ready}><Play aria-hidden /> {pomo.remaining < pomo.total ? "Continuar" : "Começar"}</Button>}
                  <Button variant="outline" onClick={() => pomo.reset()} aria-label="Reiniciar etapa"><RotateCcw aria-hidden /></Button>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  Ciclo: {Math.min(pomo.done, tools.cycles)}/{tools.cycles} focos até a pausa longa · hoje: <strong>{pomo.today}</strong> pomodoro{pomo.today === 1 ? "" : "s"}
                </p>
              </div>
            )}

            {tab === "som" && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">Ruído contínuo ajuda a abafar barulho e manter o foco. Use fone.</p>
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de som">
                  {(["branco", "rosa", "marrom"] as const).map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={tools.noise === n} onClick={() => update({ noise: n })}
                      className={cn("min-h-11 rounded-control border text-sm font-semibold capitalize", tools.noise === n ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border")}>
                      {n}
                    </button>
                  ))}
                </div>
                <label className="grid gap-1 text-sm font-semibold">
                  Volume
                  <input type="range" min={0} max={1} step={0.05} value={tools.volume} onChange={(e) => update({ volume: Number(e.target.value) })} className="accent-[var(--primary)]" />
                </label>
                {noise.playing
                  ? <Button variant="soft" onClick={noise.stop}><Pause aria-hidden /> Parar som</Button>
                  : <Button onClick={noise.play}><Play aria-hidden /> Tocar ruído {tools.noise}</Button>}
              </div>
            )}

            {tab === "notas" && <Notes initial={initialNotes} />}
            {tab === "respirar" && <Breathing />}

            {tab === "ajustes" && (
              <div className="flex flex-col gap-3 text-sm">
                <Num label="Foco (min)" value={tools.focusMin} min={5} max={120} onChange={(v) => update({ focusMin: v })} />
                <Num label="Pausa curta (min)" value={tools.shortMin} min={1} max={30} onChange={(v) => update({ shortMin: v })} />
                <Num label="Pausa longa (min)" value={tools.longMin} min={5} max={60} onChange={(v) => update({ longMin: v })} />
                <Num label="Focos até a pausa longa" value={tools.cycles} min={2} max={8} onChange={(v) => update({ cycles: v })} />
                <Check label="Emendar a próxima etapa sozinho" checked={tools.autoStart} onChange={(v) => update({ autoStart: v })} />
                <Check label="Tocar um aviso ao terminar" checked={tools.chime} onChange={(v) => update({ chime: v })} />
                <Check label="Notificação no celular/computador" checked={tools.notify} onChange={async (v) => {
                  if (v && typeof Notification !== "undefined" && Notification.permission !== "granted") {
                    const p = await Notification.requestPermission().catch(() => "denied" as const);
                    if (p !== "granted") return;
                  }
                  update({ notify: v });
                }} />
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">Posição do botão</span>
                  <div className="flex gap-1 rounded-full bg-muted p-1" role="radiogroup" aria-label="Posição do botão">
                    {(["left", "right"] as const).map((s) => (
                      <button key={s} type="button" role="radio" aria-checked={tools.side === s} onClick={() => update({ side: s })}
                        className={cn("min-h-9 rounded-full px-3 text-xs font-bold", tools.side === s ? "bg-card shadow-sm" : "text-muted-foreground")}>
                        {s === "left" ? "Esquerda" : "Direita"}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {saved === "saving" ? "Salvando…" : saved === "ok" ? "Salvo no seu perfil: vale na próxima vez, em qualquer aparelho." : saved === "erro" ? "Não foi possível salvar agora." : "Os ajustes ficam salvos no seu perfil."}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      <button type="button" onClick={() => toggle(!open)} aria-expanded={open} aria-controls={open ? panelId : undefined}
        aria-label={pomo.running ? `Ferramentas de estudo — ${pomo.label}: ${fmtClock(pomo.remaining)}` : "Ferramentas de estudo"}
        className={cn("flex h-12 items-center gap-2 rounded-full px-4 font-bold shadow-lg transition-colors",
          pomo.running ? (pomo.phase === "focus" ? "bg-primary text-primary-foreground" : "bg-success text-white dark:text-[#0d0d1a]") : "bg-card text-foreground ring-1 ring-border hover:bg-muted")}>
        <Timer className="size-5" aria-hidden />
        {pomo.running ? <span className="tabular-nums">{fmtClock(pomo.remaining)}</span> : <span className="text-sm">Foco</span>}
        {noise.playing && <Headphones className="size-4" aria-label="som ambiente tocando" />}
      </button>
    </div>
  );
}

/** Valor guardado no sessionStorage/localStorage, lido sem descompasso na hidratação (servidor = vazio). */
const STORE_EVENT = "vr:dock";
function useStored(kind: "session" | "local", key: string): [string | null, (v: string) => void] {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener(STORE_EVENT, cb);
    window.addEventListener("storage", cb);
    return () => { window.removeEventListener(STORE_EVENT, cb); window.removeEventListener("storage", cb); };
  }, []);
  const read = () => { try { return (kind === "session" ? sessionStorage : localStorage).getItem(key); } catch { return null; } };
  const value = useSyncExternalStore(subscribe, read, () => null);
  const set = useCallback((v: string) => {
    try { (kind === "session" ? sessionStorage : localStorage).setItem(key, v); } catch {}
    window.dispatchEvent(new Event(STORE_EVENT));
  }, [kind, key]);
  return [value, set];
}

function Ring({ progress, phase, children }: { progress: number; phase: Phase; children: React.ReactNode }) {
  const r = 70, c = 2 * Math.PI * r;
  return (
    <div className="relative flex size-44 items-center justify-center">
      <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="80" cy="80" r={r} fill="none" strokeWidth="10" className="stroke-muted" />
        <circle cx="80" cy="80" r={r} fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - progress)}
          className={cn("transition-[stroke-dashoffset] duration-1000 ease-linear", phase === "focus" ? "stroke-primary" : "stroke-success")} />
      </svg>
      <div className="relative flex flex-col items-center">{children}</div>
    </div>
  );
}

function Num({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-semibold">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={`Diminuir ${label}`} onClick={() => onChange(Math.max(min, value - 1))} className="size-9 rounded-full bg-muted font-bold">−</button>
        <span className="w-8 text-center tabular-nums" aria-live="polite">{value}</span>
        <button type="button" aria-label={`Aumentar ${label}`} onClick={() => onChange(Math.min(max, value + 1))} className="size-9 rounded-full bg-muted font-bold">+</button>
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-9 items-center justify-between gap-3">
      <span className="font-semibold">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-[var(--primary)]" />
    </label>
  );
}

/** Anotações rápidas: aparelho na hora, perfil com atraso (para a próxima sessão). */
function Notes({ initial }: { initial: string }) {
  // o painel só abre no cliente, então dá para ler a cópia do aparelho já no estado inicial
  const [text, setText] = useState(() => {
    if (initial) return initial;
    try { return localStorage.getItem(NOTES_KEY) ?? ""; } catch { return ""; }
  });
  const [state, setState] = useState<"idle" | "saving" | "ok" | "erro">("idle");
  const timer = useRef<number | null>(null);
  const change = (v: string) => {
    const t = v.slice(0, NOTES_MAX);
    setText(t);
    try { localStorage.setItem(NOTES_KEY, t); } catch {}
    setState("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => setState((await saveStudyNotesAction(t)).ok ? "ok" : "erro"), 1200);
  };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="vr-notas" className="text-sm text-muted-foreground">Fórmulas, dúvidas para o tutor, lembretes…</label>
      <textarea id="vr-notas" value={text} onChange={(e) => change(e.target.value)} rows={9} maxLength={NOTES_MAX}
        className="w-full resize-y rounded-control border border-input bg-background p-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <p className="flex justify-between text-xs text-muted-foreground" aria-live="polite">
        <span>{state === "saving" ? "Salvando…" : state === "ok" ? "Salvo" : state === "erro" ? "Sem conexão: salvo só neste aparelho" : ""}</span>
        <span>{text.length}/{NOTES_MAX}</span>
      </p>
    </div>
  );
}

/** Respiração guiada 4-4-6 (inspira, segura, solta): bom para a pausa e antes de prova. */
const BREATH = [{ t: "Inspire", s: 4 }, { t: "Segure", s: 4 }, { t: "Solte", s: 6 }];
function Breathing() {
  const [on, setOn] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = window.setTimeout(() => setStep((x) => (x + 1) % 3), BREATH[step].s * 1000);
    return () => window.clearTimeout(id);
  }, [on, step]);
  const cur = BREATH[step];
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className={cn("flex size-36 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground transition-transform ease-in-out",
        on && step === 0 && "scale-110", on && step === 2 && "scale-75")} style={{ transitionDuration: `${cur.s}s` }}>
        <span className="text-lg font-bold" aria-live="polite">{on ? cur.t : "Pronto?"}</span>
      </div>
      <Button variant={on ? "soft" : "primary"} onClick={() => { setOn(!on); setStep(0); }}>{on ? "Parar" : "Começar"}</Button>
      <p className="text-center text-xs text-muted-foreground">Inspire 4 s, segure 4 s, solte 6 s. Três ou quatro ciclos já acalmam.</p>
    </div>
  );
}
