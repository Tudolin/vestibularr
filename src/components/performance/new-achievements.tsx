"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { refreshAchievementsAction } from "@/app/(app)/desempenho/actions";
import { ACHIEVEMENTS } from "@/lib/achievements";

/**
 * Depois que a página aparece, pede ao servidor para recalcular as conquistas (fora do caminho
 * crítico do carregamento). Se houver novas: anuncia e atualiza a lista.
 */
export function NewAchievements() {
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    void refreshAchievementsAction().then((codes) => {
      if (!alive || !codes.length) return;
      codes.forEach((c, i) => {
        const a = ACHIEVEMENTS.find((x) => x.code === c);
        if (a) setTimeout(() => toast.success(`${a.emoji} Conquista: ${a.title}`, { description: a.desc }), 400 * i);
      });
      router.refresh();
    });
    return () => { alive = false; };
  }, [router]);
  return null;
}
