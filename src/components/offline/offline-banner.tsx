"use client";

import { CheckCircle2, CloudOff, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useOnline } from "@/lib/use-online";

export const WORKS_OFFLINE = [
  "Simulados e treinos já abertos (as respostas ficam no aparelho e são enviadas quando a internet voltar)",
  "Treinos e páginas que você baixou em Perfil → Estudar sem internet",
  "Redações já começadas: escreva à vontade, tudo é salvo no aparelho",
  "Caderno de erros, desempenho e dicas (a última versão que você viu)",
  "Pomodoro, som ambiente, notas e respiração",
];
export const NEEDS_INTERNET = [
  "Correção de redação por IA — dá para pedir agora: ela entra na fila e é enviada quando a conexão voltar",
  "Ler redação por foto (transcrição por IA)",
  "Começar um simulado novo ou a triagem (as questões são sorteadas no servidor)",
  "Tripulação: ranking, liga, boosts e mural",
  "Busca e notificações",
];

/** Faixa "sem internet" com o que funciona e o que não; avisa quando a conexão volta. */
export function OfflineBanner() {
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const was = useRef(online);
  useEffect(() => {
    if (!was.current && online) toast.success("Arr! Internet de volta. Enviando o que ficou guardado…");
    was.current = online;
  }, [online]);
  if (online) return null;
  return (
    <>
      <div role="status" className="sticky top-[calc(3.75rem)] z-20 flex items-center gap-2 border-b border-border bg-warning-soft px-4 py-2 text-sm text-warning-soft-foreground md:top-0">
        <CloudOff className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">Err… sem internet a bordo. Você continua estudando; o que fizer fica salvo no aparelho.</span>
        <button type="button" onClick={() => setOpen(true)} className="min-h-10 shrink-0 font-bold underline underline-offset-2">O que funciona?</button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Estudando sem internet</DialogTitle>
          <DialogDescription>Tudo que você fizer agora é guardado no aparelho e enviado sozinho quando a conexão voltar.</DialogDescription>
          <OfflineLists />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function OfflineLists() {
  return (
    <div className="grid gap-4 text-sm">
      <div>
        <p className="mb-2 font-bold text-success">Funciona offline</p>
        <ul className="grid gap-2">{WORKS_OFFLINE.map((t) => <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{t}</li>)}</ul>
      </div>
      <div>
        <p className="mb-2 font-bold text-danger">Precisa de internet</p>
        <ul className="grid gap-2">{NEEDS_INTERNET.map((t) => <li key={t} className="flex gap-2"><XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />{t}</li>)}</ul>
      </div>
    </div>
  );
}
