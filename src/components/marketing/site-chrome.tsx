import Link from "next/link";
import { cn } from "@/lib/utils";

/** Logo: rosto do Capitão Grafite + wordmark em Fredoka. */
export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2", className)} aria-label="Vestibularr — página inicial">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca */}
      <img src="/brand/grafite-rosto.svg" alt="" width={44} height={40} className="h-10 w-11" />
      <span className={cn("font-brand text-[1.7rem] font-bold leading-none tracking-tight", light ? "text-white" : "text-cobalto")}>vestibularr</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-tinta/5 bg-creme/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Logo />
        <nav aria-label="Principal" className="flex items-center gap-1 sm:gap-2">
          <Link href="/#recursos" className="hidden rounded-full px-3 py-2 text-sm font-semibold text-tinta/80 hover:text-tinta md:block">Recursos</Link>
          <Link href="/#planos" className="hidden rounded-full px-3 py-2 text-sm font-semibold text-tinta/80 hover:text-tinta md:block">Planos</Link>
          <Link href="/#perguntas" className="hidden rounded-full px-3 py-2 text-sm font-semibold text-tinta/80 hover:text-tinta md:block">Dúvidas</Link>
          <Link href="/login" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-tinta hover:bg-tinta/5">Entrar</Link>
          <CtaButton href="/cadastro" size="sm">Comece grátis</CtaButton>
        </nav>
      </div>
    </header>
  );
}

export function CtaButton({ href, children, size = "md", tone = "primary", className }: { href: string; children: React.ReactNode; size?: "sm" | "md" | "lg"; tone?: "primary" | "gema" | "ghost-light"; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-brand font-bold transition-transform active:translate-y-0.5",
        size === "sm" && "min-h-10 px-4 text-base",
        size === "md" && "min-h-12 px-6 text-lg",
        size === "lg" && "min-h-14 px-8 text-xl",
        tone === "primary" && "bg-cobalto text-white shadow-[0_4px_0_var(--color-cobalto-escuro)] hover:bg-cobalto-escuro",
        tone === "gema" && "bg-gema text-tinta shadow-[0_4px_0_#d9a21c] hover:brightness-95",
        tone === "ghost-light" && "border-2 border-white/40 text-white hover:bg-white/10",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-tinta/10 bg-creme">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-sm text-sm text-tinta/70">Estude para o ENEM e a UFPR com resolução comentada de cada questão, simulados no tempo oficial e IA que corrige sua redação.</p>
        </div>
        <nav aria-label="Produto" className="flex flex-col items-start text-sm">
          <span className="font-brand text-base font-bold text-tinta">Produto</span>
          <Link href="/#recursos" className="inline-flex min-h-10 items-center text-tinta/70 hover:text-tinta">Recursos</Link>
          <Link href="/#planos" className="inline-flex min-h-10 items-center text-tinta/70 hover:text-tinta">Planos</Link>
          <Link href="/cadastro" className="inline-flex min-h-10 items-center text-tinta/70 hover:text-tinta">Criar conta</Link>
          <Link href="/login" className="inline-flex min-h-10 items-center text-tinta/70 hover:text-tinta">Entrar</Link>
        </nav>
        <nav aria-label="Legal" className="flex flex-col items-start text-sm">
          <span className="font-brand text-base font-bold text-tinta">Transparência</span>
          <Link href="/termos" className="inline-flex min-h-10 items-center text-tinta/70 hover:text-tinta">Termos de Uso</Link>
          <Link href="/privacidade" className="inline-flex min-h-10 items-center text-tinta/70 hover:text-tinta">Política de Privacidade</Link>
          <span className="text-tinta/60">Questões: provas oficiais do INEP (ENEM) e da UFPR, com a fonte citada em cada uma.</span>
        </nav>
      </div>
      <p className="pb-8 text-center text-xs text-tinta/65">© {new Date().getFullYear()} Vestibularr. Não somos afiliados ao INEP, ao MEC nem à UFPR.</p>
    </footer>
  );
}
