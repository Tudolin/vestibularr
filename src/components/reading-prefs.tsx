"use client";

import { Download, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocalPref } from "@/lib/use-local-pref";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Tamanho da fonte de leitura (questões e textos de apoio) — mesmo ajuste da tela da prova. */
export function ReadingFontControl() {
  const [scale, setScale] = useLocalPref<number>("vr:fontScale", 1);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2" role="group" aria-label="Tamanho da fonte de leitura">
        <Button variant="outline" size="icon" aria-label="Diminuir fonte" onClick={() => setScale(Math.max(0.85, +(scale - 0.1).toFixed(2)))}><Minus /></Button>
        <output className="w-16 text-center font-mono font-bold" aria-live="polite">{Math.round(scale * 100)}%</output>
        <Button variant="outline" size="icon" aria-label="Aumentar fonte" onClick={() => setScale(Math.min(1.6, +(scale + 0.1).toFixed(2)))}><Plus /></Button>
      </div>
      <p className="rounded-control bg-muted p-3" style={{ fontSize: `${scale}rem` }}>Exemplo: assim fica o enunciado das questões.</p>
    </div>
  );
}

/** Botão "Instalar app" quando o navegador oferece (Android/Chrome/desktop). iPhone: instruções. */
export function InstallAppButton() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const t = setTimeout(() => {
      setInstalled(window.matchMedia("(display-mode: standalone)").matches);
      setIos(/iphone|ipad/i.test(navigator.userAgent));
    }, 0);
    return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  if (installed) return <p className="text-sm text-muted-foreground">App instalado neste aparelho. ✓</p>;
  if (evt) return <Button variant="soft" onClick={async () => { await evt.prompt(); setEvt(null); }}><Download aria-hidden /> Instalar app</Button>;
  if (ios) return <p className="text-sm text-muted-foreground">No iPhone: toque em Compartilhar e depois em “Adicionar à Tela de Início”.</p>;
  return <p className="text-sm text-muted-foreground">No Chrome/Edge: menu ⋮ → “Instalar app” (ou ícone na barra de endereço).</p>;
}
