import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string; saiu?: string }> }) {
  const { next, erro, saiu } = await searchParams;
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <GraduationCap className="size-8" aria-hidden />
        </span>
        <h1 className="text-3xl font-extrabold">Vestibularr</h1>
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
