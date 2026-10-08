"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ToastDemo() {
  return <Button size="sm" variant="outline" onClick={() => toast.success("Progresso salvo")}>Mostrar toast</Button>;
}
