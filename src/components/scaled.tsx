"use client";

import { useLocalPref } from "@/lib/use-local-pref";

/** Aplica o tamanho de fonte de leitura escolhido no Perfil (ou na prova) ao conteúdo. */
export function Scaled({ children, className }: { children: React.ReactNode; className?: string }) {
  const [scale] = useLocalPref<number>("vr:fontScale", 1);
  return <div className={className} style={{ fontSize: `${scale}rem` }}>{children}</div>;
}
