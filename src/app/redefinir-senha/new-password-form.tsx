"use client";

import { Loader2 } from "lucide-react";
import { startTransition, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { newPasswordAction } from "./actions";

export function NewPasswordForm({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState(newPasswordAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      {/* Ajuda o gerenciador de senhas a salvar a senha nova na conta certa. */}
      {email && <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Senha nova</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required placeholder="Mínimo de 8 caracteres"
          aria-invalid={!!errors?.password} aria-describedby={errors?.password ? "pw-err" : undefined} />
        <FieldError id="pw-err">{errors?.password?.[0]}</FieldError>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm">Repita a senha nova</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required placeholder="Digite a mesma senha"
          aria-invalid={!!errors?.confirm} aria-describedby={errors?.confirm ? "confirm-err" : undefined} />
        <FieldError id="confirm-err">{errors?.confirm?.[0]}</FieldError>
      </div>
      {state && !state.ok && !errors && <FieldError>{state.error}</FieldError>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Salvar senha nova
      </Button>
    </form>
  );
}
