import Link from "next/link";
import { BOARD_OPTIONS } from "@/lib/boards";
import { cn } from "@/lib/utils";

export function BoardFilter({ base, board }: { base: string; board: string | null }) {
  return (
    <nav aria-label="Filtrar por vestibular ou concurso" className="flex max-w-full gap-1 rounded-full border border-border bg-muted p-1 text-sm font-semibold">
      {[["", "Todos"], ...BOARD_OPTIONS].map(([v, l]) => (
        <Link key={v} href={v ? `${base}?vestibular=${v}` : base} aria-current={(board ?? "") === v ? "page" : undefined}
          className={cn("flex min-h-10 min-w-0 items-center rounded-full px-3 sm:px-4", (board ?? "") === v ? "bg-card shadow-sm" : "text-muted-foreground")}>{l}</Link>
      ))}
    </nav>
  );
}
