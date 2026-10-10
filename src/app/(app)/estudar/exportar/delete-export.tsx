"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteExportAction } from "./actions";

export function DeleteExport({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" aria-label="Apagar lista" disabled={pending}
      onClick={() => confirm("Apagar esta lista? (não devolve a exportação do mês)") && start(async () => { await deleteExportAction(id); })}>
      <Trash2 aria-hidden />
    </Button>
  );
}
