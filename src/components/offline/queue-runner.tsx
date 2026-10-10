"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { submitEssayAction } from "@/app/(app)/redacao/actions";
import { drafts } from "@/lib/attempt/outbox";
import { createClient } from "@/lib/supabase/client";
import { correctionQueue } from "@/lib/use-online";

/**
 * Envia as correções de redação pedidas sem internet assim que a conexão volta (em qualquer tela do app).
 * Antes de enviar, sobe a última versão do texto guardada no aparelho.
 */
export function QueueRunner() {
  const busy = useRef(false);
  useEffect(() => {
    const run = async () => {
      if (busy.current || !navigator.onLine) return;
      const queue = correctionQueue.list();
      if (!queue.length) return;
      busy.current = true;
      const supabase = createClient();
      try {
        for (const q of queue) {
          const d = await drafts.get(q.id);
          if (d && !d.synced) {
            const { error } = await supabase.rpc("save_essay_draft", { p_essay: q.id, p_content: d.content, p_client_ts: d.client_ts, p_device: "fila", p_source: d.source });
            if (error && !/essay_submitted/.test(error.message)) continue; // tenta de novo depois
            if (!error) await drafts.markSynced(q.id, d.client_ts);
          }
          const r = await submitEssayAction(q.id);
          if (r.ok || /enviada|submitted|já foi/i.test(r.error ?? "")) {
            correctionQueue.remove(q.id);
            if (r.ok) toast.success(`Arr! “${q.title}” foi enviada para correção 📝`, { action: { label: "Ver", onClick: () => location.assign(`/redacao/${q.id}`) } });
          } else if (/limite|cota|plan_limit/i.test(r.error ?? "")) {
            correctionQueue.remove(q.id);
            toast.error(`“${q.title}”: ${r.error}`);
          }
        }
      } finally {
        busy.current = false;
      }
    };
    void run();
    window.addEventListener("online", run);
    window.addEventListener("vr:fila", run);
    const id = window.setInterval(run, 60_000);
    return () => { window.removeEventListener("online", run); window.removeEventListener("vr:fila", run); window.clearInterval(id); };
  }, []);
  return null;
}
