"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";
import { setGuideDismissedAction } from "@/app/(app)/guia/actions";
import { GuideVideo } from "@/components/guide-video";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const KEY = "vr:guia-fechado";
const EVENT = "vr:guia";

/** Fechado nesta sessão do navegador? (sessionStorage via useSyncExternalStore: sem mismatch na hidratação) */
function useClosedThisSession(): [boolean, () => void] {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener(EVENT, cb);
    return () => window.removeEventListener(EVENT, cb);
  }, []);
  const read = () => { try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; } };
  const closed = useSyncExternalStore(subscribe, read, () => true);
  const close = useCallback(() => {
    try { sessionStorage.setItem(KEY, "1"); } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [closed, close];
}

/**
 * Vídeo de boas-vindas: aparece ao entrar até a pessoa marcar "Não mostrar novamente"
 * (preferência no perfil). Fechar sem marcar só esconde nesta sessão do navegador.
 */
export function WelcomeGuide({ show }: { show: boolean }) {
  const pathname = usePathname();
  const [closed, close] = useClosedThisSession();
  const [never, setNever] = useState(false);
  const open = show && !closed && pathname !== "/guia";

  const finish = () => {
    close();
    if (never) void setGuideDismissedAction(true);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(); }}>
      <DialogContent className="md:max-w-3xl">
        <DialogTitle>Bem-vindo ao Vestibularr! 👋</DialogTitle>
        <DialogDescription>Um tour de 2 minutos mostrando como estudar por aqui. Você pode rever quando quiser na aba Guia.</DialogDescription>
        <GuideVideo />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
            <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={never} onChange={(e) => setNever(e.target.checked)} />
            Não mostrar novamente
          </label>
          <Button size="lg" onClick={finish}>Começar a estudar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
