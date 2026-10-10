"use client";

import { Loader2, Repeat } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startAttemptAction } from "../../actions";
import { needsInternet } from "@/lib/use-online";

export function RetryButton({ attemptId, count }: { attemptId: string; count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button disabled={pending} onClick={() => start(async () => {
      if (needsInternet("Montar o treino")) return;
      const r = await startAttemptAction({ mode: "treino", retry_attempt: attemptId });
      if (r.ok) router.push(`/prova/${r.id}`);
      else toast.error(r.error);
    })}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Repeat aria-hidden />} Refazer {count} em treino
    </Button>
  );
}
