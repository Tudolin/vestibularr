"use client";

import { Loader2, Pencil, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveGoalsAction } from "@/app/(app)/desempenho/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { DEFAULT_GOALS, GOAL_LABEL, type GoalKind } from "@/lib/achievements";

export function GoalsCard({ goals, progress, editable }: { goals: Partial<Record<GoalKind, number>>; progress: Record<GoalKind, number>; editable: boolean }) {
  const g = { ...DEFAULT_GOALS, ...goals };
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const met = (Object.keys(g) as GoalKind[]).filter((k) => progress[k] >= g[k]).length;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Target className="size-4" aria-hidden /> Metas ({met}/4 cumpridas)</CardTitle>
        {editable && <Button variant="ghost" size="sm" onClick={() => setOpen(true)}><Pencil aria-hidden /> Editar</Button>}
      </CardHeader>
      <CardContent className="grid gap-3">
        {(Object.keys(g) as GoalKind[]).map((k) => (
          <div key={k} className="grid gap-1">
            <div className="flex justify-between text-sm"><span>{GOAL_LABEL[k]}</span><span className="font-semibold">{progress[k]}/{g[k]}{progress[k] >= g[k] ? " ✓" : ""}</span></div>
            <Progress value={(progress[k] / g[k]) * 100} label={GOAL_LABEL[k]} barClassName={progress[k] >= g[k] ? "bg-success" : undefined} />
          </div>
        ))}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Minhas metas</DialogTitle>
          <DialogDescription>Metas realistas ajudam a manter a sequência. A semana começa na segunda.</DialogDescription>
          <form className="grid gap-3" onSubmit={(e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            start(async () => { const r = await saveGoalsAction(f); if (r.ok) { toast.success("Metas salvas"); setOpen(false); router.refresh(); } else toast.error(r.error); });
          }}>
            {(Object.keys(g) as GoalKind[]).map((k) => (
              <div key={k} className="grid gap-1"><Label htmlFor={k}>{GOAL_LABEL[k]}</Label><Input id={k} name={k} type="number" min={1} defaultValue={g[k]} /></div>
            ))}
            <Button type="submit" size="lg" disabled={pending}>{pending && <Loader2 className="animate-spin" aria-hidden />} Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
