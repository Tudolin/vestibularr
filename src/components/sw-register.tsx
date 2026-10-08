"use client";

import { useEffect } from "react";

/** Registra o service worker só em produção (em desenvolvimento ele atrapalharia o recarregamento). */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}

/** Ao sair da conta: apaga as páginas guardadas offline (o próximo usuário do aparelho não as vê). */
export async function clearOfflinePages() {
  try {
    navigator.serviceWorker?.controller?.postMessage("clear-pages");
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("vr-pages-")).map((k) => caches.delete(k)));
  } catch {}
}
