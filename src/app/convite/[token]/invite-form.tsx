"use client";

import { Loader2 } from "lucide-react";
import { startTransition, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { redeemInviteAction } from "./actions";

export function InviteForm({ token, lockedEmail }: { token: string; lockedEmail: string | null }) {
  const [state, action, pending] = useActionState(redeemInviteAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const field = (id: string, label: string, props: React.ComponentProps<typeof Input>) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} required aria-invalid={!!errors?.[id]} aria-describedby={errors?.[id] ? `${id}-err` : undefined} {...props} />
      <FieldError id={`${id}-err`}>{errors?.[id]?.[0]}</FieldError>
    </div>
  );
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        // Envio manual: com <form action> o React 19 limpa os campos depois de cada envio, inclusive quando há erro.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="token" value={token} />
      {field("fullName", "Seu nome", { autoComplete: "name", maxLength: 80 })}
      {field("email", "E-mail", {
        type: "email", autoComplete: "username", inputMode: "email",
        ...(lockedEmail ? { defaultValue: lockedEmail, readOnly: true } : {}),
      })}
      {field("password", "Crie uma senha (mín. 8 caracteres)", { type: "password", autoComplete: "new-password", minLength: 8 })}
      {field("confirm", "Repita a senha", { type: "password", autoComplete: "new-password" })}
      {state && !state.ok && !errors && <FieldError>{state.error}</FieldError>}
      {state && !state.ok && errors && state.error !== "Confira os campos." && <FieldError>{state.error}</FieldError>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Criar conta
      </Button>
    </form>
  );
}
