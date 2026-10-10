"use client";

import { useQuery } from "@tanstack/react-query";
import { Camera, History, Loader2, PenLine, RefreshCcw, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { reopenEssayAction, retryJobAction, submitEssayAction, transcribePhotoAction } from "@/app/(app)/redacao/actions";
import { SaveIndicator } from "@/components/save-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { drafts } from "@/lib/attempt/outbox";
import type { SaveState } from "@/lib/attempt/types";
import { estimateLines, lineStatus, wordCount } from "@/lib/essay/lines";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { CorrectionView, type Correction } from "./correction-view";
import { correctionQueue, useOnline } from "@/lib/use-online";

export type EditorProps = {
  essay: { id: string; status: "draft" | "submitted"; kind: "enem" | "ufpr" };
  theme: { line_limit: number; min_lines: number };
  initial: { content: string; client_ts: number; server_now: number };
  versions: { id: string; created_at: string; device: string | null; is_submission: boolean; source: string; length: number }[];
  quota: { limit: number; used: number; unlimited: boolean; period?: string };
  aiReady: boolean;
};

type CorrectionRow = Correction & { job: { id: string; status: string; started_at: string | null } | null; version: { content: string } | null; stuck: boolean };

const device = () => (typeof navigator !== "undefined" && /iphone|ipad|android|mobile/i.test(navigator.userAgent) ? "celular" : "computador");
const fmtTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Reduz a foto no navegador (máx. 1600 px, JPEG) para caber no envio e economizar cota. */
async function shrink(file: File): Promise<{ base64: string; mime: "image/jpeg" }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  return { base64: dataUrl.split(",")[1], mime: "image/jpeg" };
}

const periodLabel = (p?: string) => (p === "week" ? "desta semana" : p === "month" ? "deste mês" : "de hoje");

export function EssayEditor({ essay, theme, initial, versions, quota, aiReady }: EditorProps) {
  const router = useRouter();
  const supabase = useState(() => createClient())[0];
  const [content, setContent] = useState(initial.content);
  const [save, setSave] = useState<{ state: SaveState; pending: number }>({ state: "saved", pending: 0 });
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const online = useOnline();
  const [queued, setQueued] = useState(false);
  useEffect(() => {
    const read = () => setQueued(correctionQueue.has(essay.id));
    read();
    window.addEventListener("vr:fila", read);
    return () => window.removeEventListener("vr:fila", read);
  }, [essay.id]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [photo, setPhoto] = useState<{ text: string; illegible: string[]; confidence: string } | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offset = useRef(0);
  const sourceRef = useRef<"typed" | "photo">("typed");
  const latest = useRef({ content: initial.content, ts: initial.client_ts, synced: true });
  const readOnly = essay.status === "submitted";

  // ------------------------------------------------------------------ correção (acompanha o status)
  const corr = useQuery({
    queryKey: ["correction", essay.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("essay_corrections")
        .select("id, status, total, max_total, error, admin_comment, created_at, feedback, job:ai_jobs(id, status, started_at), version:essay_versions(content)")
        .eq("essay_id", essay.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const row = data as unknown as CorrectionRow;
      // "travada": rodando há mais de 3 min (a função de fundo pode ter sido encerrada)
      row.stuck = row.job?.status === "running" && !!row.job.started_at && Date.now() - new Date(row.job.started_at).getTime() > 3 * 60_000;
      return row;
    },
    refetchInterval: (q) => (q.state.data && ["queued", "running"].includes(q.state.data.status) ? 3000 : false),
  });

  // versões: busca ao abrir o histórico (inclui as salvas depois que a página carregou)
  const history = useQuery({
    queryKey: ["versions", essay.id],
    enabled: historyOpen,
    initialData: versions,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await supabase.from("essay_versions").select("id, created_at, device, is_submission, source, content").eq("essay_id", essay.id).order("created_at", { ascending: false }).limit(50);
      return (data ?? []).map((v) => ({ id: v.id, created_at: v.created_at, device: v.device, is_submission: v.is_submission, source: v.source, length: v.content.length }));
    },
  });
  const versionList = history.data ?? versions;

  // ------------------------------------------------------------------ salvar (servidor) com fila local
  const push = useCallback(async () => {
    const snap = { ...latest.current };
    if (snap.synced || readOnly) return;
    if (!navigator.onLine) return setSave({ state: "offline", pending: 1 });
    setSave({ state: "saving", pending: 1 });
    const { data, error } = await supabase.rpc("save_essay_draft", {
      p_essay: essay.id, p_content: snap.content, p_client_ts: snap.ts, p_device: device(), p_source: sourceRef.current,
    });
    if (error) {
      if (/essay_submitted/.test(error.message)) return router.refresh();
      return setSave({ state: "offline", pending: 1 });
    }
    offset.current = (data as { server_now: number }).server_now - Date.now();
    await drafts.markSynced(essay.id, snap.ts);
    if (latest.current.ts === snap.ts) {
      latest.current.synced = true;
      setSave({ state: "saved", pending: 0 });
    }
  }, [essay.id, readOnly, router, supabase]);

  const onChange = (value: string) => {
    setContent(value);
    const ts = Math.max(Date.now() + offset.current, latest.current.ts + 1);
    latest.current = { content: value, ts, synced: false };
    setSave({ state: "saving", pending: 1 });
    void drafts.put({ essay_id: essay.id, content: value, client_ts: ts, synced: false, source: sourceRef.current }); // antes da rede
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void push(), 2000);
  };

  // rascunho local não sincronizado de uma sessão anterior (ex.: escreveu offline e fechou)
  useEffect(() => {
    offset.current = initial.server_now - Date.now();
    let alive = true;
    void (async () => {
      const d = await drafts.get(essay.id);
      if (!alive || !d || d.synced || readOnly || d.client_ts <= initial.client_ts || d.content === initial.content) return;
      latest.current = { content: d.content, ts: d.client_ts, synced: false };
      sourceRef.current = d.source;
      setContent(d.content);
      toast.message("Recuperamos um rascunho que ainda não tinha sido salvo no servidor.");
      void push();
    })();
    const online = () => void push();
    const offline = () => !latest.current.synced && setSave({ state: "offline", pending: 1 });
    const vis = () => document.visibilityState === "hidden" && void push();
    const retry = setInterval(() => { if (!latest.current.synced) void push(); }, 15_000);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", vis);
    return () => {
      alive = false;
      clearInterval(retry);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", vis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essay.id]);

  // ------------------------------------------------------------------ foto → texto
  async function onPhoto(file?: File) {
    if (!file) return;
    if (!navigator.onLine) {
      if (fileRef.current) fileRef.current.value = "";
      return void toast.error("Ler a foto precisa de internet (a IA faz a transcrição). Tire a foto agora e envie quando a conexão voltar, ou digite o texto.");
    }
    if (!aiReady) return void toast.error("A transcrição por IA ainda não foi configurada.");
    setTranscribing(true);
    try {
      const img = await shrink(file);
      const r = await transcribePhotoAction(img);
      if (r.ok) setPhoto(r.data);
      else toast.error(r.error);
    } catch {
      toast.error("Não foi possível ler a imagem.");
    } finally {
      setTranscribing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ------------------------------------------------------------------ enviar / reescrever
  function submit() {
    if (!navigator.onLine) {
      // sem internet: o texto já está no aparelho; a correção vai para a fila e sai sozinha quando a conexão voltar
      correctionQueue.add({ id: essay.id, title: document.title.split(" ·")[0] || "Sua redação", at: Date.now() });
      setConfirmOpen(false);
      return void toast.success("Sem internet agora: sua redação entrou na fila e vai para correção assim que a conexão voltar.");
    }
    start(async () => {
      if (timer.current) clearTimeout(timer.current);
      await push();
      if (!latest.current.synced) return void toast.error("Sem conexão: o texto está guardado neste aparelho. Envie quando a internet voltar.");
      const r = await submitEssayAction(essay.id);
      setConfirmOpen(false);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Redação enviada! A correção leva alguns segundos.");
      router.refresh();
      void corr.refetch();
    });
  }

  const lines = estimateLines(content);
  const status = lineStatus(lines, theme.line_limit, theme.min_lines);
  const c = corr.data;
  const stuck = !!c?.stuck;

  return (
    <div className="flex flex-col gap-4">
      {/* barra de ferramentas */}
      <div className="flex flex-wrap items-center gap-2">
        <SaveIndicator state={save.state} pending={save.pending} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}><History aria-hidden /> Versões</Button>
          {!readOnly && (
            <>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" id="foto" onChange={(e) => void onPhoto(e.target.files?.[0])} />
              <Button asChild variant="outline" size="sm" aria-disabled={transcribing}>
                <label htmlFor="foto" className="cursor-pointer">{transcribing ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />} {transcribing ? "Lendo a foto…" : "Enviar foto"}</label>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* folha */}
      <div className="relative">
        <label htmlFor="texto" className="sr-only">Texto da redação</label>
        <textarea
          id="texto"
          value={content}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => void push()}
          placeholder={readOnly ? "" : "Escreva aqui. Tudo é salvo sozinho, mesmo sem internet."}
          spellCheck={false}
          className={cn(
            "min-h-[28rem] w-full resize-y rounded-card border border-input bg-card p-5 text-base leading-8",
            "bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_calc(2rem-1px),var(--border)_calc(2rem-1px),var(--border)_2rem)] bg-[length:100%_2rem] bg-local",
            readOnly && "opacity-90",
          )}
        />
      </div>
      <p className={cn("text-sm", status === "ok" ? "text-muted-foreground" : "font-semibold text-danger")} aria-live="polite">
        ≈ {lines}/{theme.line_limit} linhas · {wordCount(content)} palavras
        {status === "over" && " — passou do limite de linhas!"}
        {status === "short" && essay.kind === "enem" && " — redações com até 7 linhas recebem nota zero."}
      </p>

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-3">
          {queued ? (
            <div role="status" className="flex flex-wrap items-center gap-2 rounded-control bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Na fila: vai para correção quando a internet voltar.
              <button type="button" className="min-h-10 font-bold underline" onClick={() => correctionQueue.remove(essay.id)}>Cancelar</button>
            </div>
          ) : (
            <Button size="lg" disabled={pending || content.trim().length < 20} onClick={() => setConfirmOpen(true)}>
              <Send aria-hidden /> {online ? "Enviar para correção" : "Corrigir quando voltar a internet"}
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            {aiReady ? (quota.unlimited ? "Correções por IA ilimitadas no seu plano." : `Correções ${periodLabel(quota.period)}: ${quota.used}/${quota.limit}`) : "Correção por IA ainda não configurada."}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={pending} onClick={() => start(async () => { const r = await reopenEssayAction(essay.id); if (r.ok) router.refresh(); else toast.error(r.error); })}>
            <PenLine aria-hidden /> Reescrever (nova versão)
          </Button>
        </div>
      )}

      {/* correção */}
      {c && (c.status === "queued" || (c.status === "running" && !stuck)) && (
        <Card className="flex items-center gap-3 p-5" role="status" aria-live="polite">
          <Sparkles className="size-5 animate-pulse text-primary" aria-hidden />
          <div><p className="font-bold">Corrigindo…</p><p className="text-sm text-muted-foreground">Pode sair desta tela: a correção continua e fica salva aqui.</p></div>
        </Card>
      )}
      {c && (c.status === "failed" || stuck) && (
        <Card className="flex flex-col gap-3 border-danger p-5 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm"><strong>A correção falhou.</strong> {c.error ?? "O serviço demorou demais."} Falhas não contam na sua cota.</p>
          {c.job && <Button variant="outline" disabled={pending} onClick={() => start(async () => { const r = await retryJobAction(c.job!.id); if (r.ok) { toast.success("Tentando de novo…"); void corr.refetch(); } else toast.error(r.error); })}><RefreshCcw aria-hidden /> Tentar de novo</Button>}
        </Card>
      )}
      {c?.status === "done" && <CorrectionView c={c} text={c.version?.content ?? content} />}

      {/* confirmar envio */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>{online ? "Enviar para correção?" : "Sem internet agora"}</DialogTitle>
          <DialogDescription>
            {!online && "A correção por IA precisa de internet. Sua redação fica salva no aparelho e entra na fila: ela é enviada sozinha quando a conexão voltar (com o app aberto). "}
            O texto fica congelado como versão enviada. Depois você pode reescrever e enviar de novo.
            {!quota.unlimited && ` Isso usa 1 das ${quota.limit} correções ${periodLabel(quota.period)} (já usou ${quota.used}).`}
          </DialogDescription>
          <Button size="lg" disabled={pending} onClick={submit}>{pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />} {online ? "Enviar" : "Colocar na fila"}</Button>
        </DialogContent>
      </Dialog>

      {/* revisar transcrição */}
      <Dialog open={!!photo} onOpenChange={(o) => !o && setPhoto(null)}>
        <DialogContent className="md:max-w-2xl">
          <DialogTitle>Revise a transcrição</DialogTitle>
          <DialogDescription>
            A IA copiou o texto da foto sem corrigir. Confira e ajuste antes de usar.
            {photo?.confidence === "baixa" && " A confiança foi baixa: revise com atenção."}
          </DialogDescription>
          {photo && photo.illegible.length > 0 && (
            <p className="rounded-control bg-warning-soft p-2 text-sm text-warning-soft-foreground">Trechos ilegíveis: {photo.illegible.join("; ")}</p>
          )}
          <textarea
            aria-label="Texto transcrito"
            className="min-h-64 w-full rounded-control border border-input bg-card p-3 text-base leading-7"
            value={photo?.text ?? ""}
            onChange={(e) => setPhoto((p) => (p ? { ...p, text: e.target.value } : p))}
          />
          <Button size="lg" onClick={() => { sourceRef.current = "photo"; onChange(photo!.text); setPhoto(null); toast.success("Texto inserido. Ele já está sendo salvo."); }}>Usar este texto</Button>
        </DialogContent>
      </Dialog>

      {/* histórico de versões */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogTitle>Versões salvas</DialogTitle>
          <DialogDescription>Nada é apagado. Restaurar cria uma nova versão com o texto antigo.</DialogDescription>
          <ul className="grid max-h-80 gap-2 overflow-y-auto">
            {versionList.map((v) => (
              <li key={v.id} className="flex items-center gap-2 rounded-control border border-border p-3 text-sm">
                <span className="flex-1">
                  {fmtTime.format(new Date(v.created_at))} · {v.device ?? "—"} · {v.length} caracteres
                  {v.is_submission && <Badge tone="primary" className="ml-2">enviada</Badge>}
                  {v.source === "photo" && <Badge className="ml-2">foto</Badge>}
                </span>
                {!readOnly && (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => {
                    const { error } = await supabase.rpc("restore_essay_version", { p_essay: essay.id, p_version: v.id });
                    if (error) return void toast.error("Não foi possível restaurar.");
                    setHistoryOpen(false);
                    toast.success("Versão restaurada");
                    router.refresh();
                  })}>Restaurar</Button>
                )}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
