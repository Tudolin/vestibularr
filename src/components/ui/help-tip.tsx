"use client";

import { CircleHelp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HELP, type Help, type HelpKey } from "@/lib/help";
import { cn } from "@/lib/utils";

/**
 * Botão "?" ao lado de um conceito que pode confundir (TRI, escudo, liga…). Abre uma explicação curta,
 * em linguagem simples. Os textos ficam em src/lib/help.ts para manter o mesmo tom em todo o app.
 */
export function HelpTip({ topic, className }: { topic: HelpKey; className?: string }) {
  const h: Help = HELP[topic];
  return (
    <Dialog>
      <DialogTrigger
        aria-label={`O que é ${h.title.toLowerCase()}?`}
        className={cn(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
          className,
        )}
      >
        <CircleHelp className="size-[18px]" aria-hidden />
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="pr-10 font-brand text-xl font-bold">{h.title}</DialogTitle>
        <DialogDescription asChild>
          <div className="flex flex-col gap-3 text-base text-foreground">
            {h.body.map((p, i) => <p key={i}>{p}</p>)}
            {h.example && <p className="rounded-control bg-muted p-3 text-sm"><span className="font-bold">Exemplo: </span>{h.example}</p>}
          </div>
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
