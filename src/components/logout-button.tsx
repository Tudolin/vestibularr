"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { clearOfflinePages } from "@/components/sw-register";
import { Button } from "@/components/ui/button";

/** Sair: limpa o cache offline de páginas antes de encerrar a sessão. */
export function LogoutButton({ variant = "icon" }: { variant?: "icon" | "full" }) {
  return (
    <form action={logoutAction} onSubmit={() => { void clearOfflinePages(); }}>
      {variant === "icon" ? (
        <button aria-label="Sair" className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted md:size-9">
          <LogOut className="size-4" />
        </button>
      ) : (
        <Button type="submit" variant="outline" size="lg" className="w-full">Sair</Button>
      )}
    </form>
  );
}
