import type { Outbox } from "./outbox";
import type { Op, SaveState, SyncResponse } from "./types";

export type SyncDeps = {
  attemptId: string;
  store: Pick<Outbox, "add" | "list" | "remove" | "count">;
  /** Envia um lote ao servidor. Deve lançar em erro de rede/5xx (o lote permanece na fila). */
  send: (ops: Op[]) => Promise<SyncResponse>;
  debounceMs?: number;
  onState?: (s: { state: SaveState; pending: number }) => void;
  onResponse?: (r: SyncResponse) => void;
  now?: () => number;
  /** injeção para testes */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
  isOnline?: () => boolean;
};

const BATCH = 200;

/**
 * Autosave com debounce + fila persistente + retentativa.
 * Estados: saved (fila vazia), saving (enviando/aguardando debounce), offline (falhou; será reenviado).
 * Rejeições definitivas do servidor (late/finished/invalid…) tiram a op da fila; erros de rede mantêm.
 */
export class SyncEngine {
  private timer: unknown = null;
  private flushing: Promise<void> | null = null;
  private backoff = 0;
  private offline = false;
  private pending = 0;
  private stopped = false;
  /** Gravações na fila ainda em andamento: flush() espera por elas para não "perder" a última. */
  private writes = new Set<Promise<unknown>>();
  private d: Required<Pick<SyncDeps, "debounceMs" | "now" | "setTimer" | "clearTimer" | "isOnline">> & SyncDeps;

  constructor(deps: SyncDeps) {
    this.d = {
      debounceMs: 2000,
      now: () => Date.now(),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      isOnline: () => (typeof navigator === "undefined" ? true : navigator.onLine),
      ...deps,
    };
  }

  /** Enfileira (persistindo antes de qualquer rede) e agenda o envio com debounce. */
  enqueue(op: Omit<Op, "op_id" | "attempt_id" | "ts"> & { ts?: number }): Promise<Op> {
    const p = this.doEnqueue(op);
    this.writes.add(p);
    void p.finally(() => this.writes.delete(p)).catch(() => {});
    return p;
  }

  private async doEnqueue(op: Omit<Op, "op_id" | "attempt_id" | "ts"> & { ts?: number }) {
    const full = { ...op, op_id: crypto.randomUUID(), attempt_id: this.d.attemptId, ts: op.ts ?? this.d.now() } as Op;
    // Coalescência: com "última escrita por campo", só a operação mais recente de cada
    // (questão, campo) importa. Evita crescer a fila ao digitar offline por horas.
    const stale = (await this.d.store.list(this.d.attemptId)).filter((o) => o.question_id === full.question_id && o.field === full.field && o.ts <= full.ts);
    if (stale.length) await this.d.store.remove(stale.map((o) => o.op_id));
    await this.d.store.add(full);
    this.pending = await this.d.store.count(this.d.attemptId);
    this.emit("saving");
    this.schedule(this.d.debounceMs);
    return full;
  }

  /** Envia já (trocar de questão, voltar à aba, reconectar, finalizar). */
  flush(): Promise<void> {
    if (this.timer) {
      this.d.clearTimer(this.timer);
      this.timer = null;
    }
    this.flushing ??= (async () => {
      await Promise.allSettled([...this.writes]);
      await this.run();
    })().finally(() => (this.flushing = null));
    return this.flushing;
  }

  /** Envia até a fila esvaziar (ou falhar): usado ao finalizar. Retorna o que sobrou. */
  async drain(maxRounds = 5): Promise<number> {
    for (let i = 0; i < maxRounds; i++) {
      await this.flush();
      const left = await this.d.store.count(this.d.attemptId);
      if (left === 0 || this.offline) return left;
    }
    return this.d.store.count(this.d.attemptId);
  }

  async refreshPending() {
    this.pending = await this.d.store.count(this.d.attemptId);
    this.emit(this.pending === 0 ? "saved" : this.offline ? "offline" : "saving");
  }

  /** Chamar ao detectar reconexão. */
  onOnline() {
    this.backoff = 0;
    void this.flush();
  }
  onOffline() {
    this.offline = true;
    this.emit("offline");
  }
  stop() {
    this.stopped = true;
    if (this.timer) this.d.clearTimer(this.timer);
  }

  private schedule(ms: number) {
    if (this.stopped) return;
    if (this.timer) this.d.clearTimer(this.timer);
    this.timer = this.d.setTimer(() => {
      this.timer = null;
      void this.flush();
    }, ms);
  }

  private emit(state: SaveState) {
    this.d.onState?.({ state, pending: this.pending });
  }

  private async run() {
    for (;;) {
      const ops = (await this.d.store.list(this.d.attemptId)).slice(0, BATCH);
      this.pending = (await this.d.store.count(this.d.attemptId)) || ops.length;
      if (ops.length === 0) {
        this.offline = false;
        this.pending = 0;
        this.emit("saved");
        return;
      }
      if (!this.d.isOnline()) {
        this.offline = true;
        this.emit("offline");
        return;
      }
      this.emit("saving");
      try {
        const res = await this.d.send(ops);
        const done = new Set([...res.applied, ...res.rejected.map((r) => r.op_id)]);
        await this.d.store.remove(ops.filter((o) => done.has(o.op_id)).map((o) => o.op_id));
        this.offline = false;
        this.backoff = 0;
        this.d.onResponse?.(res);
        if (res.rejected.length) console.warn("[sync] operações rejeitadas", res.rejected);
        if (ops.every((o) => !done.has(o.op_id))) return; // nada avançou: evita laço infinito
      } catch {
        this.offline = true;
        this.pending = await this.d.store.count(this.d.attemptId);
        this.emit("offline");
        this.backoff = Math.min(this.backoff ? this.backoff * 2 : 2000, 30_000);
        this.schedule(this.backoff); // tenta de novo sozinho
        return;
      }
    }
  }
}
