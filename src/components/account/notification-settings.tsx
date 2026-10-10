"use client";

import { Bell, BellOff, Send, Share } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { removePushSubscriptionAction, saveNotifyPrefsAction, savePushSubscriptionAction, testNotificationAction } from "@/app/(app)/perfil/notify-actions";
import { Button } from "@/components/ui/button";
import type { NotifyPrefs } from "@/lib/notifications";
import { cn } from "@/lib/utils";

type Support = "checking" | "ok" | "ios-install" | "unsupported" | "denied" | "no-server";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** Notificações: ativar neste aparelho (push), e-mail, horário do lembrete e tipos de aviso. */
export function NotificationSettings({ initial }: { initial: NotifyPrefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [support, setSupport] = useState<Support>("checking");
  const [subscribed, setSubscribed] = useState(false);
  const [pending, start] = useTransition();
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    void (async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!VAPID) return setSupport("no-server");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setSupport(ios && !standalone ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setSupport("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
      setSupport("ok");
    })();
  }, []);

  const save = useCallback((next: NotifyPrefs) => {
    setPrefs(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const r = await saveNotifyPrefsAction(next);
      if (!r.ok) toast.error(r.error);
    }, 500);
  }, []);

  const enable = () => start(async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setSupport(perm === "denied" ? "denied" : "ok"); return void toast.error("Permissão não concedida."); }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID) }));
      const r = await savePushSubscriptionAction(sub.toJSON(), navigator.userAgent);
      if (!r.ok) return void toast.error(r.error);
      setSubscribed(true);
      save({ ...prefs, push: true });
      toast.success("Notificações ativadas neste aparelho 🔔");
    } catch {
      toast.error("Não foi possível ativar neste aparelho.");
    }
  });
  const disable = () => start(async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await removePushSubscriptionAction(sub.endpoint); await sub.unsubscribe().catch(() => {}); }
    setSubscribed(false);
    toast.success("Notificações desativadas neste aparelho.");
  });

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 rounded-card bg-muted p-3">
        {support === "checking" && <p className="text-sm text-muted-foreground">Verificando este aparelho…</p>}
        {support === "ok" && (subscribed ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex flex-1 items-center gap-2 text-sm font-semibold text-success"><Bell className="size-4" aria-hidden /> Ativadas neste aparelho</p>
            <Button size="sm" variant="ghost" disabled={pending} onClick={disable}><BellOff aria-hidden /> Desativar</Button>
          </div>
        ) : (
          <Button disabled={pending} onClick={enable}><Bell aria-hidden /> Ativar notificações neste aparelho</Button>
        ))}
        {support === "ios-install" && (
          <p className="text-sm">
            <strong>No iPhone, as notificações funcionam com o app instalado:</strong> toque em <Share className="inline size-4" aria-label="Compartilhar" /> Compartilhar → “Adicionar à Tela de Início” e abra o Vestibularr pelo ícone. Depois volte aqui.
          </p>
        )}
        {support === "denied" && <p className="text-sm">As notificações foram bloqueadas no navegador. Libere nas configurações do site (cadeado ao lado do endereço) e recarregue.</p>}
        {support === "unsupported" && <p className="text-sm">Este navegador não aceita notificações. Use o Chrome, o Edge ou o app instalado.</p>}
        {support === "no-server" && <p className="text-sm text-muted-foreground">As notificações ainda não foram configuradas no servidor.</p>}
      </div>

      <fieldset className="grid gap-1">
        <legend className="mb-1 text-sm font-bold">Me avise sobre</legend>
        <Toggle label="Lembrete para estudar" hint="Só nos dias em que você ainda não estudou." checked={prefs.lembrete} onChange={(v) => save({ ...prefs, lembrete: v })} />
        {prefs.lembrete && (
          <label className="flex min-h-11 items-center justify-between gap-3 pl-1 text-sm">
            <span>A partir de que horas?</span>
            <select value={prefs.hour} onChange={(e) => save({ ...prefs, hour: Number(e.target.value) })}
              className="h-11 rounded-control border border-input bg-card px-3 text-base">
              {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}h</option>)}
            </select>
          </label>
        )}
        <Toggle label="Amigos e boosts" hint="Pedido de amizade, vento a favor e empurrões." checked={prefs.social} onChange={(v) => save({ ...prefs, social: v })} />
        <Toggle label="Liga da semana" hint="Domingo à tarde: sua posição e quanto falta para subir." checked={prefs.liga} onChange={(v) => save({ ...prefs, liga: v })} />
      </fieldset>

      <Button variant="outline" disabled={pending} onClick={() => start(async () => {
        const r = await testNotificationAction();
        if (!r.ok) return void toast.error(r.error);
        toast.success(`Teste enviado${r.data?.push ? ` para ${r.data.push} aparelho(s)` : ""}$.`);
      })}>
        <Send aria-hidden /> Enviar um teste
      </Button>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-control px-1 py-1">
      <span className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors after:absolute after:-inset-2 after:content-['']", checked ? "bg-primary" : "bg-muted-foreground/40")}>
        <span className={cn("absolute top-1 size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
        <span className="sr-only">{label}</span>
      </button>
    </label>
  );
}
