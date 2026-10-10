import { AVATAR_COLORS, type Card } from "@/lib/social";
import { cn } from "@/lib/utils";

/** Avatar social: emoji sobre um círculo colorido (sem foto, por segurança). */
export function Avatar({ card, size = "md", className }: { card: Pick<Card, "avatar" | "username">; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = size === "lg" ? "size-16 text-3xl" : size === "sm" ? "size-8 text-base" : "size-11 text-xl";
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full", s, AVATAR_COLORS[card.avatar?.color] ?? AVATAR_COLORS.cobalto, className)}>
      {card.avatar?.emoji ?? "🐱"}
    </span>
  );
}

export const handle = (c: Pick<Card, "username">) => (c.username ? `@${c.username}` : "sem apelido");
