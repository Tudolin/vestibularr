import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ erro?: string; email?: string }> }) {
  const { erro, email } = await searchParams;
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca */}
        <img src="/brand/grafite-rosto.svg" alt="" width={88} height={80} className="h-20 w-22" />
        <h1 className="font-display text-2xl font-bold">Esqueceu a senha?</h1>
        <p className="text-muted-foreground">Acontece com todo marujo. Digite seu e-mail e mandamos um link para você criar uma senha nova.</p>
      </div>
      {erro === "link" && (
        <p role="alert" className="rounded-control bg-warning-soft px-4 py-3 text-sm font-medium text-warning-soft-foreground">
          Esse link expirou ou já foi usado. Peça um novo abaixo.
        </p>
      )}
      <ForgotForm email={email} />
      <p className="text-center text-sm text-muted-foreground">
        Lembrou? <Link href="/login" className="font-semibold text-primary underline underline-offset-2">Entrar</Link>
      </p>
    </main>
  );
}
