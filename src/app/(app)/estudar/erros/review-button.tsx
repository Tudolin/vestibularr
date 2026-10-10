"use client";

import { Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startAttemptAction } from "../actions";
import { needsInternet } from "@/lib/use-online";

export function ReviewButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button size="lg" disabled={pending} onClick={() => start(async () => {
      if (needsInternet("Montar a revisão")) return;
      const r = await startAttemptAction({ mode: "revisao", count });
      if (r.ok) router.push(`/prova/${r.id}`);
      else toast.error(r.error);
    })}>
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />} Revisar {count} agora
    </Button>
  );
}
