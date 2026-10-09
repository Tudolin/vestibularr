import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/marketing/site-chrome";
import { SignUpForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar conta grátis", description: "Crie sua conta no Vestibularr e ganhe 7 dias de Pro grátis." };

export default function CadastroPage() {
  return (
    <main id="conteudo" className="min-h-dvh bg-creme">
      <div className="mx-auto grid min-h-dvh max-w-5xl items-center gap-10 px-4 py-10 md:grid-cols-2">
        <div className="hidden flex-col gap-6 md:flex">
          <Logo />
          <h1 className="font-brand text-5xl font-bold leading-[1.02] text-tinta">Bora começar? Leva menos de um minuto.</h1>
          <ul className="flex flex-col gap-3 text-lg text-tinta/80">
            <li>✓ Questões do ENEM com resolução comentada</li>
            <li>✓ Simulados no tempo oficial, até offline</li>
            <li>✓ Redação corrigida por IA, por competência</li>
          </ul>
          {/* eslint-disable-next-line @next/next/no-img-element -- ilustração SVG */}
          <img src="/brand/grafite-deitado.svg" alt="" width={520} height={232} className="w-full max-w-md" />
        </div>
        <div className="flex flex-col gap-6">
          <div className="md:hidden"><Logo /></div>
          <div>
            <h1 className="font-brand text-3xl font-bold text-tinta md:hidden">Crie sua conta grátis</h1>
            <h2 className="hidden font-brand text-3xl font-bold text-tinta md:block">Crie sua conta grátis</h2>
            <p className="mt-1 text-tinta/70">Já tem conta? <Link href="/login" className="font-semibold text-cobalto underline underline-offset-2">Entrar</Link></p>
          </div>
          <SignUpForm />
        </div>
      </div>
    </main>
  );
}
