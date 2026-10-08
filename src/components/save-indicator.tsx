import { Check, CloudOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveState = "saved" | "saving" | "offline";

const MAP = {
  saved: { icon: Check, text: "Salvo", cls: "text-success" },
  saving: { icon: Loader2, text: "Salvando…", cls: "text-muted-foreground" },
  offline: { icon: CloudOff, text: "Offline — será sincronizado", cls: "text-warning-soft-foreground bg-warning-soft px-2 py-0.5 rounded-full" },
} as const;

/** Estado de autosave visível. Usado no simulado e na redação (fases 3 e 4). */
export function SaveIndicator({ state, pending = 0 }: { state: SaveState; pending?: number }) {
  const { icon: Icon, text, cls } = MAP[state];
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", cls)}>
      <Icon className={cn("size-3.5", state === "saving" && "animate-spin")} aria-hidden />
      {text}
      {state === "offline" && pending > 0 ? ` (${pending})` : ""}
    </span>
  );
}
