import { SiteFooter, SiteHeader } from "./site-chrome";

/** Página de texto legal (Termos/Privacidade): layout de leitura confortável. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="bg-creme">
        <article className="mx-auto max-w-3xl px-4 py-12 text-tinta/85 [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:font-brand [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-tinta [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:mb-3 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
          <h1 className="font-brand text-4xl font-bold text-tinta">{title}</h1>
          <p className="mt-2 text-sm text-tinta/60">Última atualização: {updated}. Rascunho em revisão jurídica.</p>
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
