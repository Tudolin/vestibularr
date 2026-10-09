"use client";

import { Loader2 } from "lucide-react";
import { startTransition, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
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
      {next && <input type="hidden" name="next" value={next} />}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="username" inputMode="email" required aria-invalid={!!errors?.email} aria-describedby={errors?.email ? "email-err" : undefined} />
        <FieldError id="email-err">{errors?.email?.[0]}</FieldError>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!errors?.password} aria-describedby={errors?.password ? "pw-err" : undefined} />
        <FieldError id="pw-err">{errors?.password?.[0]}</FieldError>
      </div>
      {state && !state.ok && !errors && <FieldError>{state.error}</FieldError>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Entrar
      </Button>
    </form>
  );
}
