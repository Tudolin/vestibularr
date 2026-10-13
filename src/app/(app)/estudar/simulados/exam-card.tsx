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
import { LANGUAGE_LABEL, type Language } from "@/lib/boards";

export type ExamItem = { id: string; name: string; year: number; board: string; minutes: number | null; count: number; languages: Language[]; pdf_url: string | null; openAttempt: string | null };

export function ExamCard({ exam }: { exam: ExamItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [askLang, setAskLang] = useState(false);

  function go(language?: Language) {
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
          <DialogDescription>Esta prova tem questões de língua estrangeira. Escolha qual você vai fazer (como na prova real).</DialogDescription>
          <div className="grid grid-cols-2 gap-2">
            {(exam.languages.length ? exam.languages : (["ingles", "espanhol"] as Language[])).map((l, i) => (
              <Button key={l} size="lg" variant={i === 0 ? "primary" : "outline"} disabled={pending} onClick={() => go(l)}>{LANGUAGE_LABEL[l]}</Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
