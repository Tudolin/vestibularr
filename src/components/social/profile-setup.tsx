"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSocialProfileAction } from "@/app/(app)/tripulacao/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AVATAR_COLORS, AVATAR_EMOJIS, type AvatarColor } from "@/lib/social";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";

/** Escolher @apelido e avatar (primeiro acesso à Tripulação, ou editar). */
export function ProfileSetup({ initial, onDone }: { initial?: { username: string | null; emoji: string; color: AvatarColor }; onDone?: () => void }) {
  const router = useRouter();
  const [username, setUsername] = useState(initial?.username ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "🐱");
  const [color, setColor] = useState<AvatarColor>(initial?.color ?? "cobalto");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const clean = username.toLowerCase().replace(/[^a-z0-9_.]/g, "");

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await saveSocialProfileAction({ username: clean, emoji, color });
          if (!r.ok) return setError(r.error);
          router.refresh();
          onDone?.();
        });
      }}
    >
      <div className="flex items-center gap-4">
        <Avatar card={{ username: clean, avatar: { emoji, color } }} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold">@{clean || "seu.apelido"}</p>
          <p className="text-sm text-muted-foreground">É assim que seus amigos e a liga vão te ver. Seu nome real não aparece.</p>
        </div>
      </div>
      <label className="grid gap-1.5 text-sm font-semibold">
        @apelido
        <div className="flex items-center gap-1">
          <span className="text-lg text-muted-foreground" aria-hidden>@</span>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false}
            placeholder="ex.: ana.estuda" aria-invalid={!!error} aria-describedby="apelido-dica" />
        </div>
        <span id="apelido-dica" className="text-xs font-normal text-muted-foreground">3 a 20 caracteres: letras, números, ponto ou _.</span>
      </label>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Avatar</legend>
        <div className="grid grid-cols-8 gap-2" role="radiogroup" aria-label="Bichinho">
          {AVATAR_EMOJIS.map((e) => (
            <button key={e} type="button" role="radio" aria-checked={emoji === e} aria-label={e} onClick={() => setEmoji(e)}
              className={cn("flex aspect-square items-center justify-center rounded-full text-2xl transition-transform active:scale-90", emoji === e ? "bg-primary-soft ring-2 ring-primary" : "bg-muted")}>
              {e}
            </button>
          ))}
        </div>
        <div className="mt-1 flex flex-wrap gap-2" role="radiogroup" aria-label="Cor">
          {(Object.keys(AVATAR_COLORS) as AvatarColor[]).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)}
              className={cn("size-10 rounded-full transition-transform active:scale-90", AVATAR_COLORS[c], color === c && "ring-4 ring-ring/50")} />
          ))}
        </div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" disabled={pending || clean.length < 3}>{pending ? "Salvando…" : "Salvar"}</Button>
    </form>
  );
}
