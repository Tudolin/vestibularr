import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Op } from "./types";

interface Schema extends DBSchema {
  outbox: { key: string; value: Op; indexes: { byAttempt: string } };
  snapshots: { key: string; value: { attempt_id: string; data: unknown; saved_at: number } };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;
/** Fecha a conexão (testes / troca de usuário): sem isso um deleteDatabase fica bloqueado. */
export async function resetOutboxConnection() {
  const p = dbPromise;
  dbPromise = null;
  if (p) (await p).close();
}

function db() {
  dbPromise ??= openDB<Schema>("vestibularr", 1, {
    upgrade(d) {
      d.createObjectStore("outbox", { keyPath: "op_id" }).createIndex("byAttempt", "attempt_id");
      d.createObjectStore("snapshots", { keyPath: "attempt_id" });
    },
  });
  return dbPromise;
}

/** Fila persistente de operações ainda não confirmadas pelo servidor (sobrevive a fechar a aba). */
export const outbox = {
  async add(op: Op) {
    await (await db()).put("outbox", op);
  },
  async list(attemptId: string): Promise<Op[]> {
    const all = await (await db()).getAllFromIndex("outbox", "byAttempt", attemptId);
    return all.sort((a, b) => a.ts - b.ts);
  },
  async remove(ids: string[]) {
    const d = await db();
    const tx = d.transaction("outbox", "readwrite");
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  },
  async count(attemptId: string) {
    return (await db()).countFromIndex("outbox", "byAttempt", attemptId);
  },
  async saveSnapshot(attemptId: string, data: unknown) {
    await (await db()).put("snapshots", { attempt_id: attemptId, data, saved_at: Date.now() });
  },
  async loadSnapshot<T>(attemptId: string): Promise<T | null> {
    return ((await (await db()).get("snapshots", attemptId))?.data as T) ?? null;
  },
  async dropSnapshot(attemptId: string) {
    await (await db()).delete("snapshots", attemptId);
  },
};
export type Outbox = typeof outbox;
