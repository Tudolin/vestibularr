import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Op } from "./types";

export type LocalDraft = { essay_id: string; content: string; client_ts: number; synced: boolean; source: "typed" | "photo" };

interface Schema extends DBSchema {
  outbox: { key: string; value: Op; indexes: { byAttempt: string } };
  snapshots: { key: string; value: { attempt_id: string; data: unknown; saved_at: number } };
  drafts: { key: string; value: LocalDraft };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;
/** Fecha a conexão (testes / troca de usuário): sem isso um deleteDatabase fica bloqueado. */
export async function resetOutboxConnection() {
  const p = dbPromise;
  dbPromise = null;
  if (p) (await p).close();
}

function db() {
  dbPromise ??= openDB<Schema>("vestibularr", 2, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore("outbox", { keyPath: "op_id" }).createIndex("byAttempt", "attempt_id");
        d.createObjectStore("snapshots", { keyPath: "attempt_id" });
      }
      if (oldVersion < 2) d.createObjectStore("drafts", { keyPath: "essay_id" });
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

/** Rascunho local de redação: guardado a cada digitação (antes da rede) e marcado ao sincronizar. */
export const drafts = {
  async put(d: LocalDraft) {
    await (await db()).put("drafts", d);
  },
  async get(essayId: string) {
    return (await db()).get("drafts", essayId);
  },
  async list() {
    return (await db()).getAll("drafts");
  },
  async markSynced(essayId: string, clientTs: number) {
    const d = await (await db()).get("drafts", essayId);
    if (d && d.client_ts === clientTs) await (await db()).put("drafts", { ...d, synced: true });
  },
};
