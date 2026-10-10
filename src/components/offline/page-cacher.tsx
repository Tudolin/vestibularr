"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// provas, redações e resultados: o que o aluno mais quer abrir sem internet
const WORTH = /^\/(prova\/[0-9a-f-]{36}|redacao\/[0-9a-f-]{36}|estudar\/resultado\/[0-9a-f-]{36})$/;

/**
 * Navegação interna do Next não passa pelo cache de páginas do service worker (vem como RSC).
 * Ao abrir uma prova ou redação, pede ao service worker para guardar a versão completa da página.
 */
export function PageCacher() {
  const pathname = usePathname();
  useEffect(() => {
    if (!WORTH.test(pathname) || !navigator.onLine) return;
    const id = window.setTimeout(() => navigator.serviceWorker?.controller?.postMessage({ type: "cache-urls", urls: [pathname], quiet: true }), 1500);
    return () => window.clearTimeout(id);
  }, [pathname]);
  return null;
}
