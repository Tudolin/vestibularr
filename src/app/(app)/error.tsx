"use client";

import { Button } from "@/components/ui/button";

/** Erro inesperado numa tela do app: explica sem drama e deixa tentar de novo. */
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca */}
      <img src="/brand/grafite-rosto.svg" alt="" width={88} height={80} />
      <h1 className="text-2xl font-extrabold">Err… algo deu errado a bordo</h1>
      <p className="max-w-sm text-muted-foreground">Seu progresso está salvo. Tente de novo; se continuar, verifique a internet.</p>
      <Button size="lg" onClick={() => retry()}>Tentar de novo</Button>
    </div>
  );
}
