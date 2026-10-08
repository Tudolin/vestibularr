"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Registra páginas principais (log de acessos do admin) e conta tempo de estudo:
 * um ping na troca de página e outro a cada 60 s com a aba visível. Falhas são ignoradas.
 */
export function ActivityPinger() {
  const path = usePathname();
  const supabase = useMemo(() => createClient(), []);
  useEffect(() => {
    const device = /iphone|ipad|android|mobile/i.test(navigator.userAgent) ? "mobile" : "desktop";
    // não registra o id de cada prova/redação no log: só a seção
    const section = path.replace(/\/[0-9a-f-]{36}.*/, "/:id");
    const ping = (p: string | null) => void supabase.rpc("ping_activity", { p_path: p, p_device: device }).then(() => {}, () => {});
    ping(section);
    const t = setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine) ping(null); }, 60_000);
    return () => clearInterval(t);
  }, [path, supabase]);
  return null;
}
