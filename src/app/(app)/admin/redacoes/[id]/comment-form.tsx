"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { commentCorrectionAction } from "../../temas/actions";

export function CommentForm({ correctionId, initial }: { correctionId: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Card className="grid gap-2 p-4">
      <label htmlFor={`c-${correctionId}`} className="text-sm font-bold">Seu comentário (o aluno vê junto da correção da IA)</label>
      <textarea id={`c-${correctionId}`} value={text} onChange={(e) => setText(e.target.value)} className="min-h-24 rounded-control border border-input bg-card p-3 text-base" maxLength={4000} />
      <Button className="justify-self-start" disabled={pending} onClick={() => start(async () => {
        const r = await commentCorrectionAction(correctionId, text);
        if (r.ok) { toast.success("Comentário salvo"); router.refresh(); } else toast.error(r.error);
      })}>{pending && <Loader2 className="animate-spin" aria-hidden />} Salvar comentário</Button>
    </Card>
  );
}
