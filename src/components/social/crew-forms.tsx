"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCrewAction, joinCrewAction } from "@/app/(app)/tripulacao/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const FLAGS = ["🏴‍☠️", "⚓", "🦜", "🐙", "🦈", "🧭", "🌊", "⭐", "🔥", "📚"];

export function CreateCrew() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(FLAGS[0]);
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-3" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await createCrewAction({ name, emoji });
        if (!r.ok) return void toast.error(r.error);
        toast.success("Tripulação criada! Agora chame a galera ⚓");
        router.push(`/tripulacao/${r.data}`);
      });
    }}>
      <label className="grid gap-1.5 text-sm font-semibold">Nome da tripulação
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="ex.: Rumo à Medicina" />
      </label>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Bandeira">
        {FLAGS.map((f) => (
          <button key={f} type="button" role="radio" aria-checked={emoji === f} aria-label={f} onClick={() => setEmoji(f)}
            className={cn("flex size-11 items-center justify-center rounded-full text-xl transition-transform active:scale-90", emoji === f ? "bg-primary-soft ring-2 ring-primary" : "bg-muted")}>{f}</button>
        ))}
      </div>
      <Button type="submit" disabled={pending || name.trim().length < 2}>{pending ? "Criando…" : "Criar tripulação"}</Button>
    </form>
  );
}

export function JoinCrew({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [pending, start] = useTransition();
  return (
    <form className="flex gap-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await joinCrewAction(code);
        if (!r.ok) return void toast.error(r.error);
        toast.success("Bem-vindo a bordo! 🏴‍☠️");
        router.push(`/tripulacao/${r.data}`);
      });
    }}>
      <label className="sr-only" htmlFor="crew-code">Código da tripulação</label>
      <Input id="crew-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="Código (8 caracteres)" autoCapitalize="characters" className="font-mono uppercase" />
      <Button type="submit" variant="soft" disabled={pending || code.trim().length !== 8}>Entrar</Button>
    </form>
  );
}
