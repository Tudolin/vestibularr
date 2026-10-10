import Link from "next/link";

/** 404 com a cara da marca. */
export default function NotFound() {
  return (
    <main id="conteudo" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca */}
      <img src="/brand/grafite-rosto.svg" alt="" width={110} height={100} />
      <h1 className="text-3xl font-extrabold">Err… essa página afundou</h1>
      <p className="max-w-sm text-muted-foreground">Procuramos no mapa e não achamos esse endereço. Pode ter mudado de lugar ou nunca ter existido.</p>
      <Link href="/inicio" className="inline-flex h-12 items-center rounded-control bg-primary px-6 font-display font-semibold text-primary-foreground shadow-[0_3px_0_var(--primary-shadow)]">Voltar ao convés ⚓</Link>
    </main>
  );
}
