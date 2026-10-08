import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { outbox, resetOutboxConnection } from "@/lib/attempt/outbox";
import { applyOp, emptyAnswer, mergeServerAndOutbox, statusOf } from "@/lib/attempt/reducer";
import { SyncEngine } from "@/lib/attempt/sync-engine";
import { crossedWarning, estimateOffset, formatClock, remainingMs } from "@/lib/attempt/timer";
import type { Op, SyncResponse } from "@/lib/attempt/types";

const A = "att-1";
const op = (field: Op["field"], value: unknown, ts: number, q: string | null = "q1"): Op =>
  ({ op_id: crypto.randomUUID(), attempt_id: A, question_id: q, field, value, ts }) as Op;

describe("reducer (última escrita por campo)", () => {
  it("ts maior vence, independente da ordem de chegada", () => {
    let s = applyOp({}, op("choice", "B", 200));
    s = applyOp(s, op("choice", "A", 100)); // chegou depois, é mais antiga
    expect(s.q1.choice).toBe("B");
  });
  it("é idempotente e campos independentes não se afetam", () => {
    const o = op("flagged", true, 50);
    const once = applyOp({}, o);
    expect(applyOp(once, o)).toEqual(once);
    const s = applyOp(applyOp({}, op("choice", "C", 10)), op("flagged", true, 5));
    expect(s.q1).toMatchObject({ choice: "C", flagged: true });
  });
  it("tempo só cresce", () => {
    let s = applyOp({}, op("time_spent_ms", 9000, 1));
    s = applyOp(s, op("time_spent_ms", 4000, 2));
    expect(s.q1.time_spent_ms).toBe(9000);
  });
  it("desmarcar (null) é uma escrita válida", () => {
    let s = applyOp({}, op("choice", "A", 1));
    s = applyOp(s, op("choice", null, 2));
    expect(s.q1.choice).toBeNull();
  });
  it("estado do servidor + fila local = o que o aluno vê (mesmo fora de ordem)", () => {
    const server = { q1: { ...emptyAnswer(), choice: "A" as const, field_ts: { choice: 100 } } };
    const merged = mergeServerAndOutbox(server, [op("choice", "D", 300), op("choice", "C", 200), op("choice", "E", 50)]);
    expect(merged.q1.choice).toBe("D");
  });
  it("status do mapa de questões", () => {
    expect(statusOf(undefined)).toBe("blank");
    expect(statusOf({ ...emptyAnswer(), choice: "A" })).toBe("answered");
    expect(statusOf({ ...emptyAnswer(), choice: "A", flagged: true })).toBe("flagged");
    expect(statusOf({ ...emptyAnswer(), discursive_text: "  " }, true)).toBe("blank");
    expect(statusOf({ ...emptyAnswer(), discursive_text: "texto" }, true)).toBe("answered");
  });
});

describe("cronômetro baseado no servidor", () => {
  it("ignora o relógio do cliente: o offset corrige um relógio adiantado", () => {
    const serverNow = 1_000_000;
    const clientNow = 5_000_000; // cliente 4.000.000 ms adiantado
    const offset = estimateOffset(serverNow, clientNow);
    const deadline = serverNow + 600_000; // 10 min no relógio do servidor
    expect(remainingMs(deadline, offset, clientNow)).toBe(600_000);
    expect(remainingMs(deadline, offset, clientNow + 60_000)).toBe(540_000);
  });
  it("nunca negativo; sem prazo = null", () => {
    expect(remainingMs(1000, 0, 5000)).toBe(0);
    expect(remainingMs(null, 0)).toBeNull();
  });
  it("formata HH:MM:SS / MM:SS", () => {
    expect(formatClock(5 * 3600_000 + 30 * 60_000)).toBe("5:30:00");
    expect(formatClock(65_000)).toBe("01:05");
  });
  it("avisos de 30 e 10 minutos disparam uma vez cada", () => {
    expect(crossedWarning(31 * 60_000, 29 * 60_000)).toBe(30 * 60_000);
    expect(crossedWarning(29 * 60_000, 28 * 60_000)).toBeNull();
    expect(crossedWarning(11 * 60_000, 9 * 60_000)).toBe(10 * 60_000);
    expect(crossedWarning(null, 100)).toBeNull();
  });
});

describe("SyncEngine (offline-first)", () => {
  beforeEach(async () => {
    await resetOutboxConnection();
    await new Promise<void>((res, rej) => {
      const r = indexedDB.deleteDatabase("vestibularr");
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  });

  const ok = (ops: Op[]): SyncResponse => ({ server_now: 1, status: "in_progress", deadline_at: null, current_index: 0, applied: ops.map((o) => o.op_id), rejected: [] });
  const make = (send: (ops: Op[]) => Promise<SyncResponse>, extra: Partial<ConstructorParameters<typeof SyncEngine>[0]> = {}) => {
    const states: string[] = [];
    const timers: (() => void)[] = [];
    const engine = new SyncEngine({
      attemptId: A, store: outbox, send, debounceMs: 2000,
      setTimer: (fn) => { timers.push(fn); return timers.length; }, clearTimer: () => {},
      onState: (s) => states.push(`${s.state}:${s.pending}`), isOnline: () => true, ...extra,
    });
    return { engine, states, timers };
  };

  it("persiste ANTES de enviar e agenda com debounce (não envia imediatamente)", async () => {
    const send = vi.fn(async (ops: Op[]) => ok(ops));
    const { engine, timers } = make(send);
    await engine.enqueue({ question_id: "q1", field: "choice", value: "A" });
    expect(send).not.toHaveBeenCalled();
    expect(await outbox.count(A)).toBe(1);
    expect(timers).toHaveLength(1);
  });

  it("coalesce: só a última escrita de cada (questão, campo) fica na fila", async () => {
    const { engine } = make(async (ops) => ok(ops));
    for (const v of ["a", "ab", "abc"]) await engine.enqueue({ question_id: "q1", field: "discursive_text", value: v });
    await engine.enqueue({ question_id: "q1", field: "choice", value: "A" });
    await engine.enqueue({ question_id: "q2", field: "discursive_text", value: "outra" });
    const left = await outbox.list(A);
    expect(left).toHaveLength(3);
    expect(left.find((o) => o.question_id === "q1" && o.field === "discursive_text")?.value).toBe("abc");
  });

  it("flush espera gravações em andamento (enqueue sem await logo antes do flush)", async () => {
    const send = vi.fn(async (ops: Op[]) => ok(ops));
    const { engine } = make(send);
    void engine.enqueue({ question_id: "q1", field: "choice", value: "A" }); // sem await, como no app
    await engine.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(await outbox.count(A)).toBe(0);
  });

  it("drain esvazia mesmo com escritas chegando durante o envio", async () => {
    let engineRef: SyncEngine | null = null;
    let first = true;
    const send = vi.fn(async (ops: Op[]) => {
      if (first) { first = false; void engineRef!.enqueue({ question_id: "q9", field: "flagged", value: true }); }
      return ok(ops);
    });
    const { engine } = make(send);
    engineRef = engine;
    await engine.enqueue({ question_id: "q1", field: "choice", value: "A" });
    expect(await engine.drain()).toBe(0);
    expect(send.mock.calls.flatMap((c) => c[0]).map((o) => o.question_id)).toEqual(["q1", "q9"]);
  });

  it("flush envia em lote, esvazia a fila e fica 'saved'", async () => {
    const send = vi.fn(async (ops: Op[]) => ok(ops));
    const { engine, states } = make(send);
    await engine.enqueue({ question_id: "q1", field: "choice", value: "A" });
    await engine.enqueue({ question_id: "q2", field: "choice", value: "B" });
    await engine.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toHaveLength(2);
    expect(await outbox.count(A)).toBe(0);
    expect(states.at(-1)).toBe("saved:0");
  });

  it("sem rede: mantém a fila, mostra 'offline' e reenvia ao reconectar sem perder nem duplicar", async () => {
    let online = false;
    const received: Op[] = [];
    const send = vi.fn(async (ops: Op[]) => {
      if (!online) throw new Error("network");
      received.push(...ops);
      return ok(ops);
    });
    const { engine, states } = make(send);
    await engine.enqueue({ question_id: "q1", field: "choice", value: "A" });
    await engine.flush();
    expect(states.at(-1)).toBe("offline:1");
    await engine.enqueue({ question_id: "q2", field: "choice", value: "C" });
    await engine.flush();
    expect(await outbox.count(A)).toBe(2);

    online = true;
    engine.onOnline();
    await engine.flush();
    expect(await outbox.count(A)).toBe(0);
    expect(received.map((o) => o.value)).toEqual(["A", "C"]); // ordem preservada
    expect(new Set(received.map((o) => o.op_id)).size).toBe(2);
    expect(states.at(-1)).toBe("saved:0");
  });

  it("a fila sobrevive a 'fechar a aba' (nova instância lê do IndexedDB)", async () => {
    const down = vi.fn(async () => { throw new Error("network"); });
    const first = make(down);
    await first.engine.enqueue({ question_id: "q1", field: "discursive_text", value: "rascunho" });
    await first.engine.flush();
    first.engine.stop();

    await resetOutboxConnection(); // simula novo carregamento da página
    const send = vi.fn(async (ops: Op[]) => ok(ops));
    const second = make(send);
    await second.engine.refreshPending();
    await second.engine.flush();
    expect(send.mock.calls[0][0][0]).toMatchObject({ field: "discursive_text", value: "rascunho" });
    expect(await outbox.count(A)).toBe(0);
  });

  it("rejeição definitiva do servidor (ex.: 'late') remove da fila e não trava", async () => {
    const send = vi.fn(async (ops: Op[]): Promise<SyncResponse> => ({ ...ok([]), applied: [], rejected: ops.map((o) => ({ op_id: o.op_id, reason: "late" })) }));
    const { engine } = make(send);
    await engine.enqueue({ question_id: "q1", field: "choice", value: "A" });
    await engine.flush();
    expect(await outbox.count(A)).toBe(0);
  });

  it("offline por navigator: não tenta enviar", async () => {
    const send = vi.fn(async (ops: Op[]) => ok(ops));
    const { engine, states } = make(send, { isOnline: () => false });
    await engine.enqueue({ question_id: "q1", field: "choice", value: "A" });
    await engine.flush();
    expect(send).not.toHaveBeenCalled();
    expect(states.at(-1)).toBe("offline:1");
  });

  it("lotes de no máximo 200 operações", async () => {
    const send = vi.fn(async (ops: Op[]) => ok(ops));
    const { engine } = make(send);
    for (let i = 0; i < 450; i++) await outbox.add(op("time_spent_ms", i, i + 1, `q${i % 5}`));
    await engine.refreshPending();
    await engine.flush();
    expect(send.mock.calls.map((c) => c[0].length)).toEqual([200, 200, 50]);
  });
});
