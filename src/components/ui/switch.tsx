import { cn } from "@/lib/utils";

/**
 * Interruptor liga/desliga. A bolinha tem posição fixa (left-1) e só desliza 20px: sem isso, o Chrome do Android
 * a posicionava a partir do centro do botão e, ligada, ela saía para fora.
 */
export function Switch({ checked, onCheckedChange, label, disabled }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onCheckedChange(!checked)}
      className={cn("relative inline-block h-7 w-12 shrink-0 rounded-full p-0 transition-colors after:absolute after:-inset-2 after:content-[''] disabled:opacity-60",
        checked ? "bg-primary" : "bg-muted-foreground/40")}>
      <span aria-hidden className={cn("absolute left-1 top-1 block size-5 rounded-full bg-white shadow transition-transform duration-200", checked ? "translate-x-5" : "translate-x-0")} />
      <span className="sr-only">{label}</span>
    </button>
  );
}
