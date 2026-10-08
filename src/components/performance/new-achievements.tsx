"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { ACHIEVEMENTS } from "@/lib/achievements";

/** Anuncia conquistas recém-ganhas (calculadas no servidor ao abrir a página). */
export function NewAchievements({ codes }: { codes: string[] }) {
  useEffect(() => {
    codes.forEach((c, i) => {
      const a = ACHIEVEMENTS.find((x) => x.code === c);
      if (a) setTimeout(() => toast.success(`${a.emoji} Conquista: ${a.title}`, { description: a.desc }), 400 * i);
    });
  }, [codes]);
  return null;
}
