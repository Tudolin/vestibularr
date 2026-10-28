"use client";

import { Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { startTransition, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { forgotPasswordAction } from "./actions";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function ForgotForm({ email }: { email?: string }) {
  const [state, action, pending] = useActionState(forgotPasswordAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  if (state?.ok) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-card border bg-card p-6 text-center">
        <MailCheck className="size-12 text-primary" aria-hidden />
        <h2 className="font-display text-xl font-bold">Confira seu e-mail</h2>
        <p className="text-muted-foreground">
          Se <b className="text-foreground">{state.data?.email}</b> tiver conta no Vestibularr, você vai receber um link para criar uma senha nova.
          Ele vale por 1 hora. Não chegou? Veja o spam ou a aba Promoções.
        </p>
        <Link href="/login" className="font-semibold text-primary underline underline-offset-2">Voltar para o login</Link>
      </div>
    );
  }

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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail da sua conta</Label>
        <Input id="email" name="email" type="email" autoComplete="username" inputMode="email" required defaultValue={email}
          aria-invalid={!!errors?.email} aria-describedby={errors?.email ? "email-err" : undefined} />
        <FieldError id="email-err">{errors?.email?.[0]}</FieldError>
      </div>
      {SITE_KEY && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={SITE_KEY} data-language="pt-br" />
        </>
      )}
      {state && !state.ok && !errors && <FieldError>{state.error}</FieldError>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Enviar link
      </Button>
    </form>
  );
}
