"use client";

import { Button } from "@/components/ui/button";
import { useOnline } from "@/lib/use-online";

/** Botão de envio de formulário que depende do servidor: sem internet fica desativado e diz o porquê. */
export function OnlineSubmit({ children, ...props }: React.ComponentProps<typeof Button>) {
  const online = useOnline();
  return (
    <Button type="submit" {...props} disabled={props.disabled || !online}>
      {online ? children : "Precisa de internet"}
    </Button>
  );
}
