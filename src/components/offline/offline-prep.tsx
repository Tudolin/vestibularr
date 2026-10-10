"use client";

import { CheckCircle2, CloudDownload } from "lucide-react";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { offlineManifestAction } from "@/app/(app)/perfil/offline-actions";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/lib/use-online";

const KEY = "vr:offline-em";
const readLast = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const subLast = (cb: () => void) => { window.addEventListener("storage", cb); window.addEventListener("vr:offline", cb); return () => { window.removeEventListener("storage", cb); window.removeEventListener("vr:offline", cb); }; };

type Progress = { done: number; total: number } | null;

/** "Baixar para estudar sem internet": manda o service worker guardar as telas e provas do aluno. */
export function OfflinePrep({ compact = false }: { compact?: boolean }) {
  const online = useOnline();
  const last = useSyncExternalStore(subLast, readLast, () => null);
  const [withPack, setWithPack] = useState(true);
  const [progress, setProgress] = useState<Progress>(null);
  const [pending, start] = useTransition();

  const run = () => start(async () => {
    const sw = navigator.serviceWorker?.controller;
    if (!sw) return void toast.error("Abra o Vestibularr pelo app instalado ou recarregue a página uma vez para ativar o modo offline.");
    const m = await offlineManifestAction(withPack);
    if (m.packError) toast.message(`Treino novo não criado: ${m.packError}`);
    setProgress({ done: 0, total: m.urls.length });
    await new Promise<void>((resolve) => {
      const onMsg = (e: MessageEvent) => {
        if (e.data?.type === "cache-progress") setProgress({ done: e.data.done, total: e.data.total });
        if (e.data?.type === "cache-done") {
          navigator.serviceWorker.removeEventListener("message", onMsg);
          try { localStorage.setItem(KEY, new Date().toISOString()); } catch {}
          window.dispatchEvent(new Event("vr:offline"));
          toast.success(`Pronto! ${e.data.ok} telas guardadas: ${m.attempts} prova(s)/treino(s), ${m.essays} redação(ões) e ${m.results} resultado(s).`);
          resolve();
        }
      };
      navigator.serviceWorker.addEventListener("message", onMsg);
      sw.postMessage({ type: "cache-urls", urls: m.urls });
    });
    setProgress(null);
  });

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="grid gap-3">
      {!compact && (
        <p className="text-sm text-muted-foreground">
          Guarda no aparelho as telas principais, seus simulados em andamento, suas redações (para escrever e revisar as correções) e os últimos resultados.
          Respostas feitas sem internet são enviadas sozinhas quando a conexão voltar.
        </p>
      )}
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" checked={withPack} onChange={(e) => setWithPack(e.target.checked)} className="size-5 accent-primary" />
        <span>Criar também um treino novo de 20 questões para fazer offline</span>
      </label>
      {progress ? (
        <div className="grid gap-1.5" role="status" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
          <p className="text-xs text-muted-foreground">Baixando {progress.done} de {progress.total}…</p>
        </div>
      ) : (
        <Button onClick={run} disabled={pending || !online} variant={compact ? "outline" : "primary"}>
          <CloudDownload aria-hidden /> {online ? (last ? "Atualizar o que está no aparelho" : "Baixar para estudar sem internet") : "Conecte-se para baixar"}
        </Button>
      )}
      {last && !progress && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-success" aria-hidden /> Última atualização: {new Date(last).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
        </p>
      )}
    </div>
  );
}
