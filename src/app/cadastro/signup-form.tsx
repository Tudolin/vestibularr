"use client";

import { Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { startTransition, useActionState } from "react";
import { FieldError, Input, Label } from "@/components/ui/input";
import { signUpAction } from "./actions";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  if (state?.ok) {
    return (
      <div role="status" className="flex flex-col items-center gap-4 rounded-3xl bg-white p-8 text-center shadow-sm">
        <MailCheck className="size-12 text-cobalto" aria-hidden />
        <h2 className="font-brand text-2xl font-bold text-tinta">Confira seu e-mail</h2>
        <p className="text-tinta/75">Enviamos um link de confirmação para <b>{state.data?.email}</b>. Abra-o neste aparelho para ativar a conta. Não chegou? Veja o spam ou a aba Promoções.</p>
        <Link href="/login" className="font-semibold text-cobalto underline underline-offset-2">Já confirmei: entrar</Link>
      </div>
    );
  }

  const field = (id: string, label: string, props: React.ComponentProps<typeof Input>) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="font-semibold text-tinta">{label}</Label>
      <Input id={id} name={id} required className="h-12 rounded-2xl border-2 border-tinta/15 bg-white text-base text-tinta placeholder:text-tinta/45 focus:border-cobalto focus:outline-none" aria-invalid={!!errors?.[id]} aria-describedby={errors?.[id] ? `${id}-err` : undefined} {...props} />
      <FieldError id={`${id}-err`}>{errors?.[id]?.[0]}</FieldError>
    </div>
  );

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
      {field("fullName", "Seu nome", { autoComplete: "name", maxLength: 80, placeholder: "Ex.: Ana Souza" })}
      {field("email", "E-mail", { type: "email", autoComplete: "username", inputMode: "email", placeholder: "voce@email.com" })}
      {field("password", "Crie uma senha", { type: "password", autoComplete: "new-password", minLength: 8, placeholder: "Mínimo de 8 caracteres" })}
      {field("confirm", "Repita a senha", { type: "password", autoComplete: "new-password", placeholder: "Digite a mesma senha" })}
      <div className="flex flex-col gap-1">
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug text-tinta/80">
          <input type="checkbox" name="terms" className="mt-0.5 size-5 shrink-0 accent-[var(--color-cobalto)]" aria-describedby={errors?.terms ? "terms-err" : undefined} />
          <span>
            Li e aceito os <Link href="/termos" target="_blank" className="font-semibold text-cobalto underline">Termos de Uso</Link> e a{" "}
            <Link href="/privacidade" target="_blank" className="font-semibold text-cobalto underline">Política de Privacidade</Link>. Se tenho menos de 18 anos, meu responsável autorizou o cadastro.
          </span>
        </label>
        <FieldError id="terms-err">{errors?.terms?.[0]}</FieldError>
      </div>
      {SITE_KEY && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={SITE_KEY} data-language="pt-br" />
        </>
      )}
      {state && !state.ok && (!errors || state.error !== "Confira os campos.") && <FieldError>{state.error}</FieldError>}
      <button type="submit" disabled={pending} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-cobalto px-6 py-3 font-brand text-xl font-bold text-white shadow-[0_4px_0_var(--color-cobalto-escuro)] transition-transform active:translate-y-0.5 disabled:opacity-70">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Criar conta grátis
      </button>
      <p className="text-center text-sm text-tinta/70">Grátis, sem cartão. Durante o beta, todos os recursos estão liberados.</p>
    </form>
  );
}
