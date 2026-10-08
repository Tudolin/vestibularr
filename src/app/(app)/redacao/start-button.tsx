"use client";

import { Loader2, PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startEssayAction } from "./actions";

export function StartEssayButton({ themeId }: { themeId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="soft" disabled={pending} onClick={() => start(async () => {
      const r = await startEssayAction(themeId);
      if (r.ok) router.push(`/redacao/${r.data}`);
      else toast.error(r.error);
    })}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <PenLine aria-hidden />} Escrever
    </Button>
  );
}
