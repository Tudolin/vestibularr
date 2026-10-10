"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "system", label: "Sistema", icon: Monitor },
  { value: "dark", label: "Escuro", icon: Moon },
] as const;

const noopSubscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // false no servidor/hidratação, true no cliente: evita mismatch do tema.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return (
    <div role="radiogroup" aria-label="Tema" className={cn("inline-flex rounded-full border border-border bg-muted p-1", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              "flex size-11 items-center justify-center rounded-full text-muted-foreground md:size-9",
              active && "bg-card text-foreground shadow-sm",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

/** Versão compacta (topo do celular): um botão que alterna Claro → Escuro → Sistema. */
export function ThemeCycleButton({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const cur = OPTIONS.find((o) => o.value === (mounted ? theme : "system")) ?? OPTIONS[1];
  const order = ["light", "dark", "system"] as const;
  const next = OPTIONS.find((o) => o.value === order[(order.indexOf(cur.value) + 1) % 3])!;
  const Icon = cur.icon;
  return (
    <button type="button" onClick={() => setTheme(next.value)} aria-label={`Tema: ${cur.label}. Trocar para ${next.label}`}
      className={cn("flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted", className)}>
      <Icon className="size-5" aria-hidden />
    </button>
  );
}
