"use client";

import { AnimatePresence, LazyMotion, m } from "framer-motion";
import dynamic from "next/dynamic";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Eye, EyeOff, Flag, Grid3x3, Highlighter, Keyboard, Loader2, Minus, Pause, Play, Plus, Send,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Alternative, type AltState } from "@/components/exam/alternative";
import { applyHighlights, selectionSnippets } from "@/components/exam/highlight";
import { QuestionMap } from "@/components/exam/question-map";
import { areaBadge } from "@/components/question-view";
import { SaveIndicator } from "@/components/save-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { outbox } from "@/lib/attempt/outbox";
import { answerFromServer, applyOp, emptyAnswer, mergeServerAndOutbox, statusOf } from "@/lib/attempt/reducer";
import { SyncEngine } from "@/lib/attempt/sync-engine";
import { crossedWarning, estimateOffset, formatClock, remainingMs } from "@/lib/attempt/timer";
import type { AnswersMap, AttemptMode, AttemptStatus, FieldName, Label, LocalAnswer, Op, SaveState, SyncResponse } from "@/lib/attempt/types";
import { createClient } from "@/lib/supabase/client";
import { useLocalPref } from "@/lib/use-local-pref";
import { cn } from "@/lib/utils";

export type RunnerQuestion = {
  id: string; number: number | null; year: number | null; area: string | null; subject: string | null;
  kind: "objective" | "discursive"; statement_html: string; extra_images: string[]; line_limit: number | null; language: string | null; section: string | null;
  /** HTML já sanitizado no servidor (markdownToHtml) */
  alternatives: { label: string; html: string; image_url: string | null }[];
};
type ServerAnswer = Parameters<typeof answerFromServer>[0] & { question_id: string };
export type RunnerState = {
  server_now: number;
  attempt: {
    id: string; mode: AttemptMode; title: string; status: AttemptStatus; config: Record<string, unknown>;
    started_at: number; deadline_at: number | null; paused_at: number | null; current_index: number;
  };
  answers: ServerAnswer[];
};
type Feedback = { correct: string | null; explanation: string | null; mirror: string | null } | "loading" | "offline";

const noopSubscribe = () => () => {};
// Framer Motion em modo leve: os recursos de animação carregam depois, fora do caminho crítico.
const loadMotion = () => import("framer-motion").then((mod) => mod.domAnimation);
// O parser de markdown só é baixado quando o treino mostra uma resolução.
const Markdown = dynamic(() => import("@/components/markdown").then((mod) => mod.Markdown), { ssr: false });
const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
/** Estimativa de linhas manuscritas: ~80 caracteres por linha da folha de resposta. */
const estimateLines = (t: string) => t.split("\n").reduce((n, p) => n + Math.max(1, Math.ceil(p.length / 80)), 0);

export function ExamRunner({ initial, questions }: { initial: RunnerState; questions: RunnerQuestion[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const attemptId = initial.attempt.id;
  const mode = initial.attempt.mode;
  const immediate = mode === "treino" || mode === "revisao";
  const n = questions.length;

  // ------------------------------------------------------------------ estado
  const [answers, setAnswers] = useState<AnswersMap>(() =>
    Object.fromEntries(initial.answers.map((a) => [a.question_id, answerFromServer(a)])),
  );
  const [index, setIndex] = useState(() => Math.min(Math.max(initial.attempt.current_index, 0), n - 1));
  const [status, setStatus] = useState<AttemptStatus>(initial.attempt.status);
  const [deadline, setDeadline] = useState<number | null>(initial.attempt.deadline_at);
  const [remaining, setRemaining] = useState<number | null>(null);
  // Começa em "saving": só vira "Salvo" depois de conferir a fila offline (nunca afirmar salvo sem saber).
  const [save, setSave] = useState<{ state: SaveState; pending: number }>({ state: "saving", pending: 0 });
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [showResolution, setShowResolution] = useState(false);
  // treino/revisão: tocar só marca; "Responder" confirma (evita responder por um toque errado)
  const [pending, setPending] = useState<Record<string, Label | null>>({});
  const [mapOpen, setMapOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  const [highlighter, setHighlighter] = useState(false);
  const [hideTimer, setHideTimer] = useLocalPref<boolean>("vr:hideTimer", false);
  const [fontScale, setFontScale] = useLocalPref<number>("vr:fontScale", 1);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const offsetRef = useRef(0);
  const lastTsRef = useRef(0);
  const engineRef = useRef<SyncEngine | null>(null);
  const answersRef = useRef(answers);
  const indexRef = useRef(index);
  const enterRef = useRef(0);
  const prevRemaining = useRef<number | null>(null);
  const statementRef = useRef<HTMLDivElement>(null);
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(0);
  const feedbackRef = useRef(feedback);
  const maybeFeedbackRef = useRef<(i: number) => void>(() => {});
  // Relógio: só no cliente (o render não pode depender de Date.now()).
  useEffect(() => {
    offsetRef.current = estimateOffset(initial.server_now, Date.now());
    enterRef.current = Date.now();
  }, [initial.server_now]);

  const q = questions[index];
  const a: LocalAnswer = answers[q?.id] ?? emptyAnswer();
  const fb = q ? feedback[q.id] : undefined;
  const locked = status !== "in_progress" || timeUp || finishing;


  // ------------------------------------------------------------------ escrita (local primeiro, depois fila)
  const nowTs = useCallback(() => {
    const t = Math.max(Math.round(Date.now() + offsetRef.current), lastTsRef.current + 1);
    lastTsRef.current = t;
    return t;
  }, []);

  const write = useCallback((questionId: string | null, field: FieldName | "current_index", value: unknown) => {
    const ts = nowTs();
    const op = { op_id: "local", attempt_id: attemptId, question_id: questionId, field, value, ts } as Op;
    if (questionId) setAnswers((s) => applyOp(s, op));
    void engineRef.current?.enqueue({ question_id: questionId, field, value, ts } as never);
  }, [attemptId, nowTs]);

  /** Soma o tempo da questão atual (só enquanto a aba está visível) e grava o total acumulado. */
  const commitTime = useCallback(() => {
    const cur = questions[indexRef.current];
    if (!cur) return;
    const elapsed = Date.now() - enterRef.current;
    enterRef.current = Date.now();
    if (elapsed < 500 || elapsed > 6 * 3600_000) return;
    const total = (answersRef.current[cur.id]?.time_spent_ms ?? 0) + elapsed;
    write(cur.id, "time_spent_ms", total);
  }, [questions, write]);

  // Texto discursivo: eco local imediato + escrita na fila após 600 ms parado. A escrita pendente
  // guarda A QUAL questão pertence, e é descarregada ao navegar/sair (nunca se perde ao trocar).
  const pendingText = useRef<{ qid: string; value: string } | null>(null);
  const flushText = useCallback(() => {
    if (textTimer.current) { clearTimeout(textTimer.current); textTimer.current = null; }
    const p = pendingText.current;
    pendingText.current = null;
    if (p) write(p.qid, "discursive_text", p.value);
  }, [write]);
  // ------------------------------------------------------------------ servidor
  const applyServer = useCallback((r: Pick<SyncResponse, "server_now" | "status" | "deadline_at">, sentAt?: number) => {
    if (sentAt) offsetRef.current = estimateOffset(r.server_now, Date.now(), Date.now() - sentAt);
    setStatus(r.status);
    setDeadline(r.deadline_at);
  }, []);

  const refreshFromServer = useCallback(async () => {
    const sentAt = Date.now();
    const { data, error } = await supabase.rpc("attempt_state", { p_attempt: attemptId });
    if (error || !data) return;
    const st = data as RunnerState;
    applyServer({ server_now: st.server_now, status: st.attempt.status, deadline_at: st.attempt.deadline_at }, sentAt);
    // Outro aparelho pode ter respondido: funde por campo (vence o mais recente) + fila local.
    const pending = await outbox.list(attemptId);
    setAnswers((local) => {
      let merged = local;
      for (const row of st.answers) {
        const srv = answerFromServer(row);
        for (const [field, ts] of Object.entries(srv.field_ts)) {
          merged = applyOp(merged, { op_id: "srv", attempt_id: attemptId, question_id: row.question_id, field: field as FieldName, value: srv[field as FieldName], ts: Number(ts) } as Op);
        }
        merged = applyOp(merged, { op_id: "srv", attempt_id: attemptId, question_id: row.question_id, field: "time_spent_ms", value: srv.time_spent_ms, ts: 0 } as Op);
      }
      return mergeServerAndOutbox(merged, pending);
    });
  }, [applyServer, attemptId, supabase]);

  // ------------------------------------------------------------------ motor de sincronização
  useEffect(() => {
    const engine = new SyncEngine({
      attemptId,
      store: outbox,
      debounceMs: 2000,
      onState: setSave,
      send: async (ops) => {
        const sentAt = Date.now();
        const { data, error } = await supabase.rpc("sync_attempt", {
          p_attempt: attemptId,
          p_ops: ops.map(({ op_id, question_id, field, value, ts }) => ({ op_id, question_id, field, value, ts })),
          p_device: /iphone|ipad|android|mobile/i.test(navigator.userAgent) ? "mobile" : "desktop",
        });
        if (error) throw new Error(error.message);
        const res = data as SyncResponse;
        applyServer(res, sentAt);
        return res;
      },
    });
    engineRef.current = engine;
    let cancelled = false;
    (async () => {
      // Respostas feitas offline numa sessão anterior (ainda na fila) entram por cima do servidor.
      const pending = await outbox.list(attemptId);
      if (cancelled) return;
      if (pending.length) {
        setAnswers((s) => mergeServerAndOutbox(s, pending));
        const idx = [...pending].reverse().find((o) => o.field === "current_index");
        if (idx) setIndex(Math.min(Math.max(Number(idx.value), 0), n - 1));
      }
      await engine.refreshPending();
      if (pending.length) void engine.flush();
      maybeFeedbackRef.current(indexRef.current); // treino reaberto: mostra o feedback da questão atual
    })();

    const online = () => { engine.onOnline(); void refreshFromServer(); };
    const offline = () => engine.onOffline();
    const vis = () => {
      if (document.visibilityState === "hidden") { commitTime(); void engine.flush(); }
      else { enterRef.current = Date.now(); void refreshFromServer(); }
    };
    const unload = (e: BeforeUnloadEvent) => { commitTime(); void engine.flush(); if (pendingRef.current > 0) e.preventDefault(); };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("beforeunload", unload);
    const periodic = setInterval(() => { if (document.visibilityState === "visible") commitTime(); }, 30_000);
    if (!navigator.onLine) engine.onOffline();
    return () => {
      cancelled = true;
      clearInterval(periodic);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("beforeunload", unload);
      engine.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  // ------------------------------------------------------------------ cronômetro (servidor)
  useEffect(() => {
    if (deadline == null) return;
    const tick = () => {
      const r = remainingMs(deadline, offsetRef.current);
      setRemaining(r);
      const crossed = crossedWarning(prevRemaining.current, r);
      if (crossed) toast.warning(`Faltam ${crossed / 60_000} minutos!`, { duration: 8000 });
      prevRemaining.current = r;
      if (r === 0 && status === "in_progress") setTimeUp(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline, status]);

  // ------------------------------------------------------------------ feedback imediato (treino/revisão)
  const loadFeedback = useCallback(async (qid: string) => {
    await Promise.resolve(); // nunca altera estado de forma síncrona dentro de um efeito
    setFeedback((f) => ({ ...f, [qid]: "loading" }));
    await engineRef.current?.flush();
    if (!navigator.onLine || (await outbox.count(attemptId)) > 0) {
      setFeedback((f) => ({ ...f, [qid]: "offline" }));
      return;
    }
    const { data } = await supabase.from("answer_keys").select("correct_label, explanation_md, official_mirror_md").eq("question_id", qid).maybeSingle();
    setFeedback((f) => ({ ...f, [qid]: { correct: data?.correct_label ?? null, explanation: data?.explanation_md ?? null, mirror: data?.official_mirror_md ?? null } }));
  }, [attemptId, supabase]);

  /** Ao abrir (ou voltar a) uma questão já respondida no treino, mostra o feedback dela. */
  const maybeFeedback = useCallback((i: number) => {
    const qq = questions[i];
    if (!immediate || !qq || qq.kind !== "objective") return;
    if (answersRef.current[qq.id]?.choice && !feedbackRef.current[qq.id]) void loadFeedback(qq.id);
  }, [immediate, loadFeedback, questions]);

  // ------------------------------------------------------------------ navegação
  const go = useCallback((i: number) => {
    if (i < 0 || i >= n || i === indexRef.current) return;
    flushText();
    commitTime();
    setIndex(i);
    setShowResolution(false);
    write(null, "current_index", i);
    void engineRef.current?.flush(); // salva ao trocar de questão
    maybeFeedback(i);
  }, [commitTime, flushText, maybeFeedback, n, write]);

  // Espelhos para handlers assíncronos (eventos de janela, timers) lerem o valor atual.
  useEffect(() => {
    answersRef.current = answers;
    indexRef.current = index;
    pendingRef.current = save.pending;
    feedbackRef.current = feedback;
    maybeFeedbackRef.current = maybeFeedback;
  });
  // ------------------------------------------------------------------ ações
  const choose = useCallback((label: Label) => {
    if (!q || locked || q.kind !== "objective") return;
    if (immediate && (fb || a.choice)) return; // treino: depois de responder a resposta fica travada
    if (immediate) {
      setPending((p) => ({ ...p, [q.id]: p[q.id] === label ? null : label }));
      return;
    }
    write(q.id, "choice", a.choice === label ? null : label);
  }, [a.choice, fb, immediate, locked, q, write]);

  /** Treino/revisão: confirma a alternativa marcada e mostra o gabarito. */
  const confirm = useCallback(() => {
    if (!q || locked || !immediate || fb || a.choice) return;
    const label = pending[q.id];
    if (!label) return;
    write(q.id, "choice", label);
    void loadFeedback(q.id);
  }, [a.choice, fb, immediate, loadFeedback, locked, pending, q, write]);

  const strike = useCallback((label: Label) => {
    if (!q || locked) return;
    const s = a.strikes.includes(label) ? a.strikes.filter((x) => x !== label) : [...a.strikes, label];
    write(q.id, "strikes", s);
  }, [a.strikes, locked, q, write]);

  const toggleFlag = useCallback(() => {
    if (!q || locked) return;
    write(q.id, "flagged", !a.flagged);
    toast(a.flagged ? "Desmarcada" : "Marcada para revisão", { duration: 1200 });
  }, [a.flagged, locked, q, write]);

  const onText = (value: string) => {
    if (!q || locked) return;
    if (pendingText.current && pendingText.current.qid !== q.id) flushText();
    setAnswers((s) => ({ ...s, [q.id]: { ...(s[q.id] ?? emptyAnswer()), discursive_text: value } })); // eco imediato
    pendingText.current = { qid: q.id, value };
    if (textTimer.current) clearTimeout(textTimer.current);
    textTimer.current = setTimeout(flushText, 600);
  };

  // ------------------------------------------------------------------ marca-texto
  useEffect(() => {
    if (statementRef.current) applyHighlights(statementRef.current, a.highlights);
  }, [a.highlights, q?.id]);

  const onStatementPointerUp = () => {
    if (!highlighter || !q || locked || !statementRef.current) return;
    const pieces = selectionSnippets(statementRef.current);
    if (!pieces.length) return;
    window.getSelection()?.removeAllRanges();
    write(q.id, "highlights", [...a.highlights, ...pieces].slice(-50));
  };
  const onStatementClick = (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest("mark[data-hl]") as HTMLElement | null;
    if (!mark || !q || locked) return;
    const idx = Number(mark.dataset.hl);
    write(q.id, "highlights", a.highlights.filter((_, i) => i !== idx));
  };

  // ------------------------------------------------------------------ pausa / fim
  const pause = async () => {
    commitTime();
    await engineRef.current?.flush();
    const { data, error } = await supabase.rpc("pause_attempt", { p_attempt: attemptId });
    if (error) return toast.error("Sem conexão: não deu para pausar. O tempo continua correndo.");
    const st = data as RunnerState;
    applyServer({ server_now: st.server_now, status: st.attempt.status, deadline_at: st.attempt.deadline_at });
  };
  const resume = async () => {
    const { data, error } = await supabase.rpc("resume_attempt", { p_attempt: attemptId });
    if (error) return toast.error("Sem conexão. Tente de novo.");
    const st = data as RunnerState;
    enterRef.current = Date.now();
    applyServer({ server_now: st.server_now, status: st.attempt.status, deadline_at: st.attempt.deadline_at });
  };

  const finish = useCallback(async (auto = false) => {
    setFinishing(true);
    flushText();
    commitTime();
    const left = (await engineRef.current?.drain()) ?? (await outbox.count(attemptId));
    if (left > 0 || !navigator.onLine) {
      setFinishing(false);
      toast.error(auto ? "Tempo esgotado. Você está offline: suas respostas serão enviadas ao reconectar." : "Você está offline. Suas respostas estão guardadas; finalize quando a conexão voltar.");
      return;
    }
    const { error } = await supabase.rpc("finish_attempt", { p_attempt: attemptId });
    if (error) { setFinishing(false); return toast.error("Não foi possível finalizar. Tente de novo."); }
    router.replace(`/estudar/resultado/${attemptId}`);
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, commitTime, router, supabase]);

  // tempo esgotado: finaliza sozinho (e de novo quando reconectar)
  useEffect(() => {
    if (!timeUp) return;
    const first = setTimeout(() => void finish(true), 0);
    const again = () => void finish(true);
    window.addEventListener("online", again);
    return () => { clearTimeout(first); window.removeEventListener("online", again); };
  }, [timeUp, finish]);
  useEffect(() => {
    if (status === "expired" || status === "finished") { router.replace(`/estudar/resultado/${attemptId}`); }
  }, [status, attemptId, router]);

  // ------------------------------------------------------------------ teclado e gestos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || mapOpen || finishOpen || helpOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toUpperCase();
      const labels = q?.alternatives.map((x) => x.label) ?? [];
      if (labels.includes(k)) { e.preventDefault(); return e.shiftKey ? strike(k as Label) : choose(k as Label); }
      if (e.key === "Enter" && immediate) { e.preventDefault(); return confirm(); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
      else if (k === "M") toggleFlag();
      else if (k === "H") setHighlighter((h) => !h);
      else if (e.key === "?") setHelpOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, confirm, finishOpen, go, helpOpen, immediate, index, mapOpen, q, strike, toggleFlag]);

  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s || highlighter || window.getSelection()?.toString()) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50) go(index + (dx < 0 ? 1 : -1));
  };

  // ------------------------------------------------------------------ derivados
  const statuses = useMemo(() => questions.map((x) => statusOf(answers[x.id], x.kind === "discursive")), [answers, questions]);
  const counts = useMemo(() => ({
    answered: statuses.filter((s) => s === "answered").length + questions.filter((x, i) => statuses[i] === "flagged" && (answers[x.id]?.choice || answers[x.id]?.discursive_text?.trim())).length,
    flagged: statuses.filter((s) => s === "flagged").length,
  }), [answers, questions, statuses]);
  const blank = n - counts.answered;

  if (!q) return <p className="p-6">Esta tentativa não tem questões.</p>;

  const altState = (label: string): AltState => {
    if (immediate && fb && typeof fb === "object" && fb.correct) {
      if (label === fb.correct) return a.choice === label ? "correct" : "missed";
      if (label === a.choice) return "wrong";
      return "idle";
    }
    if (immediate && !a.choice) return pending[q.id] === label ? "selected" : "idle";
    return a.choice === label ? "selected" : "idle";
  };
  const extraImages = q.extra_images ?? [];
  const limit = q.kind === "discursive" ? q.line_limit : null;
  const lines = estimateLines(a.discursive_text ?? "");
  const lowTime = remaining != null && remaining <= 10 * 60_000;

  const timerChip = deadline != null && (
    <button
      type="button"
      onClick={() => setHideTimer(!hideTimer)}
      aria-label={hideTimer ? "Mostrar cronômetro" : "Ocultar cronômetro"}
      className={cn("flex min-h-11 items-center gap-2 rounded-full px-3 font-mono text-sm font-bold tabular-nums", lowTime ? "bg-danger-soft text-danger-soft-foreground" : "bg-muted")}
    >
      {hideTimer ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      <span role="timer" aria-live="off">{hideTimer ? "••:••" : remaining != null ? formatClock(remaining) : "--:--"}</span>
    </button>
  );

  return (
    <LazyMotion features={loadMotion} strict>
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
      {/* ------------------------------------------------ topo */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur md:px-6">
        <Button variant="ghost" size="icon" aria-label="Sair (o progresso fica salvo)" onClick={async () => { commitTime(); await engineRef.current?.flush(); router.push("/estudar"); }}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{initial.attempt.title}</p>
          <SaveIndicator state={save.state} pending={save.pending} />
        </div>
        {timerChip}
        <div className="hidden items-center gap-1 sm:flex" role="group" aria-label="Tamanho da fonte">
          <Button variant="ghost" size="icon" aria-label="Diminuir fonte" onClick={() => setFontScale(Math.max(0.85, +(fontScale - 0.1).toFixed(2)))}><Minus /></Button>
          <Button variant="ghost" size="icon" aria-label="Aumentar fonte" onClick={() => setFontScale(Math.min(1.6, +(fontScale + 0.1).toFixed(2)))}><Plus /></Button>
        </div>
        <Button variant="ghost" size="icon" className="hidden md:inline-flex" aria-label="Atalhos de teclado" onClick={() => setHelpOpen(true)}><Keyboard /></Button>
      </header>

      <div className="grid flex-1 gap-6 px-3 pb-28 pt-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:pb-8">
        {/* ------------------------------------------------ questão */}
        <main id="conteudo" className="min-w-0" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {/* Sem animação de saída: a questão anterior some na hora (nada de digitar na questão errada). */}
            <m.section
              key={q.id}
              // 1ª questão (HTML do servidor/hidratação) sem animação: aparece já visível (LCP rápido).
              initial={hydrated ? { opacity: 0, x: 12 } : false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              aria-labelledby="q-title"
              className="flex flex-col gap-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h1 id="q-title" className="text-lg font-extrabold">Questão {index + 1} <span className="text-sm font-semibold text-muted-foreground">de {n}</span></h1>
                {areaBadge(q.area)}
                {q.subject && <Badge>{q.subject}</Badge>}
                {q.year && <Badge>{q.year}{q.number ? ` · Q${q.number}` : ""}</Badge>}
                {q.language && <Badge tone="primary">{q.language === "ingles" ? "Inglês" : "Espanhol"}</Badge>}
                <div className="ml-auto flex gap-1">
                  <Button variant={highlighter ? "soft" : "ghost"} size="icon" aria-pressed={highlighter} aria-label="Marca-texto (H)" onClick={() => setHighlighter((h) => !h)}><Highlighter /></Button>
                  <Button variant={a.flagged ? "soft" : "ghost"} size="icon" aria-pressed={a.flagged} aria-label="Marcar para revisão (M)" onClick={toggleFlag} disabled={locked}><Flag /></Button>
                </div>
              </div>
              {highlighter && <p className="rounded-control bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">Marca-texto ligado: selecione trechos do enunciado. Toque num destaque para removê-lo.</p>}

              <Card className="p-4 md:p-6" style={{ fontSize: `${fontScale}rem` }}>
                <div ref={statementRef} key={q.id} onPointerUp={onStatementPointerUp} onClick={onStatementClick} className={cn(highlighter && "cursor-text selection:bg-[#fde047] selection:text-[#1a1a1a]")}>
                  <div className="prose-q space-y-3 text-[1.0625em] leading-relaxed [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:whitespace-pre-line [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-6"
                    dangerouslySetInnerHTML={{ __html: q.statement_html }} />
                </div>
                {extraImages.map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element -- figura externa da prova
                  <img key={u} src={u} alt="Figura da questão" loading="lazy" className="mx-auto mt-3 max-h-[28rem] max-w-full rounded-control bg-white" />
                ))}
              </Card>

              {q.kind === "objective" ? (
                <ol className="grid gap-2" aria-label="Alternativas" style={{ fontSize: `${fontScale}rem` }}>
                  {q.alternatives.map((alt) => (
                    <Alternative
                      key={alt.label}
                      label={alt.label}
                      html={alt.html}
                      image={alt.image_url}
                      state={altState(alt.label)}
                      struck={a.strikes.includes(alt.label as Label)}
                      disabled={locked || (immediate && (!!fb || !!a.choice))}
                      onSelect={() => choose(alt.label as Label)}
                      onStrike={() => strike(alt.label as Label)}
                    />
                  ))}
                  {immediate && !a.choice && !fb && (
                    <li className="list-none pt-1">
                      <Button size="lg" className="w-full sm:w-auto" disabled={locked || !pending[q.id]} onClick={confirm}>
                        {pending[q.id] ? `Responder ${pending[q.id]}` : "Escolha uma alternativa"}
                      </Button>
                    </li>
                  )}
                </ol>
              ) : (
                <div className="grid gap-2">
                  <label htmlFor="resp" className="text-sm font-bold">Sua resposta</label>
                  <textarea
                    id="resp"
                    value={a.discursive_text ?? ""}
                    onChange={(e) => onText(e.target.value)}
                    onBlur={flushText}
                    disabled={locked}
                    rows={10}
                    className="w-full rounded-card border border-input bg-card p-4 text-base leading-7"
                    style={{ fontSize: `${fontScale}rem` }}
                  />
                  <p className={cn("text-sm", limit && lines > limit ? "font-bold text-danger" : "text-muted-foreground")} aria-live="polite">
                    ≈ {lines} {lines === 1 ? "linha" : "linhas"}{limit ? ` de ${limit}` : ""}{limit && lines > limit ? " — passou do limite!" : ""}
                  </p>
                  {immediate && (
                    <Button variant="soft" className="self-start" disabled={!a.discursive_text?.trim() || !!fb} onClick={() => { flushText(); void loadFeedback(q.id); }}>
                      Ver espelho de resposta
                    </Button>
                  )}
                </div>
              )}

              {/* ------------------------------------------------ feedback do treino */}
              <AnimatePresence>
                {immediate && fb && (
                  <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" aria-live="polite">
                    {fb === "loading" ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Conferindo…</p>
                    ) : fb === "offline" ? (
                      <p className="rounded-control bg-warning-soft p-3 text-sm text-warning-soft-foreground">Sem conexão: sua resposta está salva e o gabarito aparece quando a internet voltar.</p>
                    ) : (
                      <Card className={cn("p-4", q.kind === "objective" && (fb.correct === a.choice ? "border-success" : "border-danger"))}>
                        {q.kind === "objective" && (
                          <p className={cn("text-lg font-extrabold", fb.correct === a.choice ? "text-success" : "text-danger")}>
                            {fb.correct === a.choice ? "Acertou! 🎉" : `Resposta certa: ${fb.correct ?? "—"}`}
                          </p>
                        )}
                        {(fb.explanation || fb.mirror) ? (
                          <>
                            <Button variant="ghost" size="sm" className="mt-1 px-0" aria-expanded={showResolution} onClick={() => setShowResolution((s) => !s)}>
                              {showResolution ? "Esconder" : "Ver"} {fb.mirror ? "espelho" : "resolução"}
                            </Button>
                            <AnimatePresence>
                              {showResolution && (
                                <m.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                  <Markdown className="pt-2 text-base">{(fb.explanation ?? fb.mirror) as string}</Markdown>
                                </m.div>
                              )}
                            </AnimatePresence>
                          </>
                        ) : (
                          q.kind === "objective" && <p className="text-sm text-muted-foreground">Esta questão ainda não tem resolução comentada.</p>
                        )}
                      </Card>
                    )}
                  </m.div>
                )}
              </AnimatePresence>

              {/* ------------------------------------------------ navegação desktop */}
              <div className="hidden items-center justify-between gap-2 lg:flex">
                <Button variant="outline" size="lg" disabled={index === 0} onClick={() => go(index - 1)}><ChevronLeft aria-hidden /> Anterior</Button>
                {index < n - 1 ? (
                  <Button size="lg" onClick={() => go(index + 1)}>Próxima <ChevronRight aria-hidden /></Button>
                ) : (
                  <Button size="lg" onClick={() => setFinishOpen(true)}><Send aria-hidden /> Finalizar</Button>
                )}
              </div>
            </m.section>
        </main>

        {/* ------------------------------------------------ painel lateral (desktop) */}
        <aside className="hidden lg:block" aria-label="Painel da prova">
          <div className="sticky top-20 flex flex-col gap-4">
            <Card className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{counts.answered}/{n} respondidas</span>
                {deadline != null && status === "in_progress" && (
                  <Button variant="ghost" size="sm" onClick={pause}><Pause aria-hidden /> Pausar</Button>
                )}
              </div>
              <QuestionMap statuses={statuses} current={index} onGo={go} />
            </Card>
            <Button size="lg" variant="soft" onClick={() => setFinishOpen(true)}><Send aria-hidden /> Finalizar {immediate ? "treino" : "prova"}</Button>
            <p className="text-xs text-muted-foreground">Atalhos: A–{q.alternatives.at(-1)?.label ?? "E"} marcar{immediate ? " · Enter responder" : ""} · Shift+letra riscar · ←/→ navegar · M revisão · H marca-texto</p>
          </div>
        </aside>
      </div>

      {/* ------------------------------------------------ barra inferior (celular) */}
      <nav aria-label="Navegação da prova" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 gap-2 border-t border-border bg-card p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden">
        <Button variant="outline" size="lg" disabled={index === 0} onClick={() => go(index - 1)} aria-label="Questão anterior"><ChevronLeft aria-hidden /></Button>
        <Button variant="soft" size="lg" onClick={() => setMapOpen(true)}><Grid3x3 aria-hidden /> {index + 1}/{n}</Button>
        {index < n - 1 ? (
          <Button size="lg" onClick={() => go(index + 1)} aria-label="Próxima questão"><ChevronRight aria-hidden /></Button>
        ) : (
          <Button size="lg" onClick={() => setFinishOpen(true)}><Send aria-hidden /> Fim</Button>
        )}
      </nav>

      {/* ------------------------------------------------ mapa (celular) */}
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent>
          <DialogTitle>Mapa de questões</DialogTitle>
          <DialogDescription>{counts.answered} respondidas · {blank} em branco · {counts.flagged} para revisar</DialogDescription>
          <QuestionMap statuses={statuses} current={index} onGo={(i) => { go(i); setMapOpen(false); }} />
          <div className="grid grid-cols-2 gap-2">
            {deadline != null && status === "in_progress" && <Button variant="outline" size="lg" onClick={() => { setMapOpen(false); void pause(); }}><Pause aria-hidden /> Pausar</Button>}
            <Button size="lg" className={deadline == null ? "col-span-2" : ""} onClick={() => { setMapOpen(false); setFinishOpen(true); }}><Send aria-hidden /> Finalizar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------ finalizar */}
      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent>
          <DialogTitle>Finalizar {immediate ? "treino" : "prova"}?</DialogTitle>
          <DialogDescription>
            {blank > 0 ? `${blank} questões em branco. ` : "Todas respondidas. "}
            {counts.flagged > 0 ? `${counts.flagged} marcadas para revisão. ` : ""}
            Depois de finalizar não dá para mudar as respostas.
          </DialogDescription>
          <div className="grid gap-2">
            <Button size="lg" disabled={finishing} onClick={() => void finish()}>{finishing ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />} Finalizar e ver resultado</Button>
            <Button size="lg" variant="outline" onClick={() => setFinishOpen(false)}>Voltar para a prova</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------ atalhos */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogTitle>Atalhos e gestos</DialogTitle>
          <ul className="grid gap-2 text-sm">
            <li><kbd className="rounded bg-muted px-1.5 font-mono">A</kbd>–<kbd className="rounded bg-muted px-1.5 font-mono">E</kbd> marcar alternativa (de novo desmarca)</li>
            {immediate && <li><kbd className="rounded bg-muted px-1.5 font-mono">Enter</kbd> responder a alternativa marcada (treino)</li>}
            <li><kbd className="rounded bg-muted px-1.5 font-mono">Shift</kbd>+letra riscar alternativa · celular: toque longo · mouse: botão direito</li>
            <li><kbd className="rounded bg-muted px-1.5 font-mono">←</kbd> <kbd className="rounded bg-muted px-1.5 font-mono">→</kbd> navegar · celular: deslize para o lado</li>
            <li><kbd className="rounded bg-muted px-1.5 font-mono">M</kbd> marcar para revisão · <kbd className="rounded bg-muted px-1.5 font-mono">H</kbd> marca-texto</li>
            <li>Tudo é salvo sozinho, mesmo offline. Dá para continuar em outro aparelho do mesmo ponto.</li>
          </ul>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------ pausa / tempo esgotado */}
      {(status === "paused" || timeUp) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-6" role="dialog" aria-modal="true" aria-labelledby="overlay-title">
          <Card className="flex max-w-sm flex-col items-center gap-4 p-6 text-center">
            <h2 id="overlay-title" className="text-xl font-extrabold">{timeUp ? "Tempo esgotado" : "Prova pausada"}</h2>
            <p className="text-muted-foreground">
              {timeUp ? (finishing ? "Enviando suas respostas…" : "Suas respostas estão salvas. Assim que houver conexão, a prova é finalizada.") : "O cronômetro está parado. As questões ficam ocultas até você retomar."}
            </p>
            {!timeUp && <Button size="lg" onClick={resume}><Play aria-hidden /> Retomar</Button>}
            {timeUp && !finishing && <Button size="lg" onClick={() => void finish(true)}>Tentar enviar agora</Button>}
          </Card>
        </div>
      )}
    </div>
    </LazyMotion>
  );
}
