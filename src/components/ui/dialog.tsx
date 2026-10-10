"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/** No celular vira bottom sheet; no desktop, modal centralizado. */
export function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-[vr-fade-in_200ms_ease-out] data-[state=closed]:animate-[vr-fade-out_150ms_ease-in_forwards]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 grid w-full gap-4 bg-card p-6 text-card-foreground shadow-xl",
          // celular: folha que sobe de baixo; computador: janela que aparece com zoom leve
          "data-[state=open]:animate-[vr-sheet-in_280ms_cubic-bezier(0.2,0.8,0.2,1)] data-[state=closed]:animate-[vr-sheet-out_180ms_ease-in_forwards]",
          "md:data-[state=open]:animate-[vr-zoom-in_200ms_cubic-bezier(0.2,0.8,0.2,1)] md:data-[state=closed]:animate-[vr-zoom-out_150ms_ease-in_forwards]",
          "inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-3xl border-t border-border pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
          "md:inset-auto md:left-1/2 md:top-1/2 md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:border md:pb-6",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Fechar"
          className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
export const DialogTitle = ({ className, ...p }: React.ComponentProps<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title className={cn("pr-10 text-xl font-bold", className)} {...p} />
);
export const DialogDescription = ({ className, ...p }: React.ComponentProps<typeof DialogPrimitive.Description>) => (
  <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...p} />
);
