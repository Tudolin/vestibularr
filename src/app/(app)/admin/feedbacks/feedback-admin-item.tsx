"use client";

import { Check, Eye, Loader2, Reply } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateFeedbackAction } from "../../feedback/actions";

/** Ações do admin num feedback: marcar como lido/resolvido e responder ao aluno. */
export function FeedbackAdminItem({ id, status, reply }: { id: string; status: string; reply: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(reply ?? "");

  const save = (patch: { status?: string; reply?: string | null }, msg: string) =>
    start(async () => {
      const r = await updateFeedbackAction({ id, ...patch });
      if (!r.ok) return void toast.error(r.error);
      toast.success(msg);
      setOpen(false);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2">
      {reply && !open && <p className="rounded-control bg-primary-soft p-3 text-sm text-primary-soft-foreground"><span className="font-bold">Sua resposta: </span>{reply}</p>}
      {open && (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Resposta para o aluno
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={3}
            className="w-full rounded-control border border-input bg-card p-3 text-base font-normal" placeholder="Ex.: Valeu! Já arrumamos, atualize o app." />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {open ? (
          <>
            <Button size="sm" disabled={pending} onClick={() => save({ reply: text.trim() || null, status: status === "novo" ? "lido" : status }, "Resposta enviada")}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Reply aria-hidden />} Enviar resposta
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Reply aria-hidden /> {reply ? "Editar resposta" : "Responder"}</Button>
            {status === "novo" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => save({ status: "lido" }, "Marcado como lido")}><Eye aria-hidden /> Marcar como lido</Button>}
            {status !== "resolvido"
              ? <Button size="sm" variant="soft" disabled={pending} onClick={() => save({ status: "resolvido" }, "Marcado como resolvido")}><Check aria-hidden /> Resolvido</Button>
              : <Button size="sm" variant="ghost" disabled={pending} onClick={() => save({ status: "lido" }, "Reaberto")}>Reabrir</Button>}
          </>
        )}
      </div>
    </div>
  );
}
