import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string; saiu?: string }> }) {
  const { next, erro, saiu } = await searchParams;
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca */}
        <img src="/brand/grafite-rosto.svg" alt="" width={88} height={80} className="h-20 w-22" />
        <h1 className="font-brand text-4xl font-bold text-primary">vestibularr</h1>
        <p className="font-display text-lg font-semibold">Ahoy! Bem-vindo a bordo ⚓</p>
        <p className="text-muted-foreground">Estude para ENEM e UFPR, no celular ou no computador.</p>
      </div>
      {erro === "link" && (
        <p role="alert" className="rounded-control bg-warning-soft px-4 py-3 text-sm font-medium text-warning-soft-foreground">
          O link de confirmação expirou ou já foi usado. Entre com seu e-mail e senha — ou crie a conta de novo.
        </p>
      )}
      {saiu === "todos" && (
        <p role="status" className="rounded-control bg-success-soft px-4 py-3 text-sm font-medium text-success-soft-foreground">
          Pronto: você saiu de todos os aparelhos. Entre de novo neste.
        </p>
      )}
      {erro === "sessao" && (
        <p role="alert" className="rounded-control bg-warning-soft px-4 py-3 text-sm font-medium text-warning-soft-foreground">
          Sua sessão expirou ou a conta foi desativada. Entre novamente.
        </p>
      )}
      <LoginForm next={next} />
      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta? <Link href="/cadastro" className="font-semibold text-primary underline underline-offset-2">Comece grátis</Link>
      </p>
    </main>
  );
}
