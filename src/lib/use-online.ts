"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
};

/** Está com internet? (no servidor e na hidratação considera online, para não piscar avisos) */
export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/** Fila de correções de redação pedidas sem internet (enviadas quando a conexão volta). */
export type QueuedEssay = { id: string; title: string; at: number };
const QKEY = "vr:fila-correcao";
export const correctionQueue = {
  list(): QueuedEssay[] {
    try { return JSON.parse(localStorage.getItem(QKEY) ?? "[]") as QueuedEssay[]; } catch { return []; }
  },
  add(e: QueuedEssay) {
    const all = correctionQueue.list().filter((x) => x.id !== e.id);
    try { localStorage.setItem(QKEY, JSON.stringify([...all, e])); } catch {}
    window.dispatchEvent(new Event("vr:fila"));
  },
  remove(id: string) {
    try { localStorage.setItem(QKEY, JSON.stringify(correctionQueue.list().filter((x) => x.id !== id))); } catch {}
    window.dispatchEvent(new Event("vr:fila"));
  },
  has(id: string) { return correctionQueue.list().some((x) => x.id === id); },
};

/** Para ações que dependem do servidor: sem internet, explica e não tenta (evita erro genérico). */
export function needsInternet(what = "Isso"): boolean {
  if (typeof navigator === "undefined" || navigator.onLine) return false;
  void import("sonner").then(({ toast }) => toast.error(`${what} precisa de internet. Enquanto isso, você pode continuar o que já está aberto ou baixado.`));
  return true;
}
