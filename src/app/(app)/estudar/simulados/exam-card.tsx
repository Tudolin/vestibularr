"use client";

import { ExternalLink, Loader2, Play, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { startAttemptAction } from "../actions";
import { needsInternet } from "@/lib/use-online";

export type ExamItem = { id: string; name: string; year: number; board: string; minutes: number | null; count: number; pdf_url: string | null; openAttempt: string | null };

export function ExamCard({ exam }: { exam: ExamItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [askLang, setAskLang] = useState(false);

  function go(language?: "ingles" | "espanhol") {
    start(async () => {
      if (needsInternet("Começar um simulado novo")) return;
      const r = await startAttemptAction({ mode: "simulado", exam_id: exam.id, language });
      if (r.ok) return router.push(`/prova/${r.id}`);
      if (r.code === "language_required") return setAskLang(true);
      toast.error(r.error);
    });
  }

  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div>
        <p className="font-bold leading-tight">{exam.name}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>{exam.count} questões</Badge>
          {exam.minutes && <Badge>{Math.floor(exam.minutes / 60)}h{String(exam.minutes % 60).padStart(2, "0")}</Badge>}
        </div>
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        {exam.openAttempt ? (
          <Button onClick={() => router.push(`/prova/${exam.openAttempt}`)}><RotateCcw aria-hidden /> Continuar</Button>
        ) : (
          <Button disabled={pending} onClick={() => go()}>{pending ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />} Fazer simulado</Button>
        )}
        {exam.pdf_url && (
          <Button asChild variant="outline"><a href={exam.pdf_url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden /> PDF</a></Button>
        )}
      </div>
      <Dialog open={askLang} onOpenChange={setAskLang}>
        <DialogContent>
          <DialogTitle>Língua estrangeira</DialogTitle>
          <DialogDescription>Esta prova tem 5 questões de língua estrangeira. Escolha qual você vai fazer (como na prova real).</DialogDescription>
          <div className="grid gap-2">
            <Button size="lg" disabled={pending} onClick={() => go("ingles")}>Inglês</Button>
            <Button size="lg" variant="outline" disabled={pending} onClick={() => go("espanhol")}>Espanhol</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
