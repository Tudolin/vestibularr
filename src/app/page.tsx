import { BookOpenCheck, Bot, Check, CloudOff, FileText, Gauge, PenLine, Timer } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { CtaButton, SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { GUIDE_POSTER, GUIDE_VIDEO } from "@/lib/guide";
import { brl, describeLimit, PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: { absolute: "Vestibularr — estude para o ENEM e a UFPR com resolução de cada questão" },
  description: "Questões do ENEM com resolução comentada, simulados no tempo oficial (até offline), caderno de erros e redação corrigida por IA. Comece grátis.",
  alternates: { canonical: "/" },
};

const RECURSOS = [
  {
    icon: Timer, kicker: "Simulado de verdade", title: "Prova inteira, no tempo oficial — sem perder nada",
    text: "O cronômetro roda no servidor: comece no celular e termine no computador. Cada marcação é salva sozinha e a prova continua funcionando sem internet.",
    img: "/landing/simulado.webp", w: 1440, h: 900, alt: "Tela de simulado com a questão, as alternativas e o mapa de questões", phone: false,
  },
  {
    icon: BookOpenCheck, kicker: "Treino com resolução", title: "Errou? Entenda o porquê na hora",
    text: "Toda questão do ENEM 2019–2024 tem resolução comentada: o raciocínio, a resposta e por que cada alternativa errada está errada. Conferida com o gabarito oficial do INEP.",
    img: "/landing/celular-resolucao.webp", w: 780, h: 1688, alt: "Treino no celular mostrando 'Acertou!' e a resolução comentada", phone: true,
  },
  {
    icon: PenLine, kicker: "Redação com IA", title: "Nota por competência em minutos",
    text: "Escreva no app — o rascunho é salvo a cada palavra — ou mande a foto da folha. A IA corrige pelas 5 competências do ENEM (ou pela grade da UFPR) e marca os trechos.",
    img: "/landing/celular-redacao.webp", w: 780, h: 1688, alt: "Correção de redação no celular com nota por competência", phone: true,
  },
  {
    icon: Gauge, kicker: "Desempenho", title: "Saiba onde focar — e quanto falta para o seu curso",
    text: "Acertos por área e assunto, mapa de calor dos pontos fracos, metas, sequência de estudo e a nota estimada para o curso que você quer.",
    img: "/landing/desempenho.webp", w: 1440, h: 900, alt: "Painel de desempenho com evolução, metas e cursos-alvo", phone: false,
  },
];

const MAIS = [
  { icon: Check, t: "Caderno de erros", d: "O que você errou volta em 1, 3, 7, 14 e 30 dias." },
  { icon: CloudOff, t: "Funciona offline", d: "Instale no celular; tudo sincroniza quando a internet volta." },
  { icon: Bot, t: "Tutor IA (em breve)", d: "Tire dúvidas de qualquer questão com um professor de bolso." },
  { icon: FileText, t: "EPUB e PDF (em breve)", d: "Monte cadernos para estudar no Kindle, tablet ou papel." },
];

const FAQ = [
  ["As questões são oficiais?", "Sim. São das provas do ENEM (INEP) e da UFPR, com a fonte citada em cada questão. As resoluções comentadas são nossas e foram conferidas com o gabarito oficial."],
  ["Serve para a UTFPR e outras federais?", "Sim. A UTFPR e muitas outras usam a nota do ENEM pelo Sisu. Para a UFPR 2027 temos o formato próprio da fase única."],
  ["Funciona sem internet?", "Funciona. Instalado no celular, o simulado em andamento e a redação continuam offline; ao reconectar, tudo é enviado sozinho."],
  ["O Grátis é grátis mesmo?", "É. Banco de questões e resoluções ilimitados, sem cartão. Os planos pagos aumentam os limites de IA, simulados e exportações."],
  ["Posso cancelar quando quiser?", "Pode, direto no app. O acesso pago segue até o fim do período já pago, e você tem 7 dias de arrependimento com reembolso integral."],
  ["É seguro para menores de idade?", "Sim. Coletamos só o necessário para os estudos, não há anúncios e o cadastro de menores de 18 anos pede a autorização do responsável."],
];

function PhoneShot({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="mx-auto w-[min(300px,78vw)] rounded-[2.6rem] bg-tinta p-2.5 shadow-[0_30px_80px_rgba(20,18,58,.25)]">
      <Image src={src} alt={alt} width={780} height={1688} priority={priority} sizes="300px" className="h-auto w-full rounded-[2.1rem]" />
    </div>
  );
}

function BrowserShot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-tinta/10 bg-white shadow-[0_30px_80px_rgba(20,18,58,.18)]">
      <div className="flex h-8 items-center gap-1.5 border-b border-tinta/10 bg-tinta/[.03] px-3" aria-hidden>
        <i className="size-2.5 rounded-full bg-[#ff5f57]" /><i className="size-2.5 rounded-full bg-[#febc2e]" /><i className="size-2.5 rounded-full bg-[#28c840]" />
      </div>
      <Image src={src} alt={alt} width={1440} height={900} sizes="(min-width: 1024px) 640px, 100vw" className="h-auto w-full" />
    </div>
  );
}

export default function Landing() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="overflow-x-clip bg-creme text-tinta">
        {/* ------------------------------------------------ hero */}
        <section className="relative">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 md:grid-cols-[1.15fr_1fr] md:pt-16">
            <div className="flex flex-col gap-6">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-gema/30 px-3 py-1 text-sm font-bold text-tinta">ENEM · UFPR 2027 · UTFPR via Sisu</span>
              <h1 className="font-brand text-[2.6rem] font-bold leading-[1.02] tracking-tight sm:text-6xl">
                Estude para o vestibular com <span className="text-cobalto">resolução de cada questão</span> e IA que corrige sua redação.
              </h1>
              <p className="max-w-xl text-lg text-tinta/75">Simulados no tempo oficial, treino com a resposta na hora, caderno de erros e nota estimada para o seu curso. No celular ou no computador — até sem internet.</p>
              <div className="flex flex-wrap gap-3">
                <CtaButton href="/cadastro" size="lg">Comece grátis</CtaButton>
                <a href="#video" className="inline-flex min-h-14 items-center rounded-2xl px-5 font-brand text-xl font-bold text-cobalto hover:bg-cobalto/5">▶ Ver em 2 minutos</a>
              </div>
              <p className="text-sm text-tinta/60">7 dias de Pro grátis · sem cartão · cancele quando quiser</p>
            </div>
            <div className="relative">
              <PhoneShot src="/landing/celular-inicio.webp" alt="Tela inicial do app no celular" />
              {/* eslint-disable-next-line @next/next/no-img-element -- mascote SVG */}
              <img src="/brand/grafite-deitado.svg" alt="Mascote do Vestibularr: um gato pirata deitado segurando um lápis" width={600} height={268} className="absolute -bottom-20 left-1/2 w-[min(420px,92vw)] -translate-x-1/2 drop-shadow-[0_10px_0_rgba(20,18,58,.08)]" />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ números */}
        <section aria-label="Em números" className="bg-cobalto text-white">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4">
            {[["1.088", "questões do ENEM 2019–2024 com resolução comentada"], ["5h30", "simulados no tempo oficial, com cronômetro no servidor"], ["5", "competências na correção de redação por IA"], ["100%", "do progresso salvo sozinho, até offline"]].map(([n, d]) => (
              <div key={n} className="flex flex-col gap-1">
                <dt className="sr-only">{d}</dt>
                <dd className="font-brand text-4xl font-bold sm:text-5xl">{n}</dd>
                <dd className="text-sm text-white/80">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ------------------------------------------------ recursos */}
        <section id="recursos" aria-labelledby="recursos-t" className="mx-auto flex max-w-6xl flex-col gap-20 px-4 py-20">
          <h2 id="recursos-t" className="sr-only">Recursos</h2>
          {RECURSOS.map((r, i) => (
            <article key={r.title} className="grid items-center gap-10 md:grid-cols-2">
              <div className={i % 2 ? "md:order-2" : ""}>
                <span className="inline-flex items-center gap-2 font-brand text-lg font-bold text-cobalto"><r.icon className="size-5" aria-hidden /> {r.kicker}</span>
                <h3 className="mt-2 font-brand text-3xl font-bold leading-tight sm:text-4xl">{r.title}</h3>
                <p className="mt-4 text-lg text-tinta/75">{r.text}</p>
              </div>
              <div className={i % 2 ? "md:order-1" : ""}>{r.phone ? <PhoneShot src={r.img} alt={r.alt} /> : <BrowserShot src={r.img} alt={r.alt} />}</div>
            </article>
          ))}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MAIS.map((m) => (
              <li key={m.t} className="rounded-3xl border border-tinta/10 bg-white p-6">
                <m.icon className="size-7 text-cobalto" aria-hidden />
                <h3 className="mt-3 font-brand text-xl font-bold">{m.t}</h3>
                <p className="mt-1 text-tinta/70">{m.d}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------ vídeo + como funciona */}
        <section id="video" aria-labelledby="video-t" className="bg-tinta py-20 text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-[1.4fr_1fr]">
            <video className="aspect-video w-full rounded-3xl bg-black shadow-2xl" src={GUIDE_VIDEO} poster={GUIDE_POSTER} controls playsInline preload="none" aria-label="Vídeo de apresentação do Vestibularr" />
            <div>
              <h2 id="video-t" className="font-brand text-4xl font-bold">Como funciona</h2>
              <ol className="mt-6 flex flex-col gap-5">
                {[["Crie sua conta", "Em menos de um minuto, com 7 dias de Pro grátis."], ["Diga seu objetivo", "Vestibular, curso e meta diária — o app se ajusta a você."], ["Estude todo dia", "Treinos curtos, simulados no fim de semana e revisão dos erros na hora certa."]].map(([t, d], i) => (
                  <li key={t} className="flex gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gema font-brand text-xl font-bold text-tinta">{i + 1}</span>
                    <span><b className="block font-brand text-xl">{t}</b><span className="text-white/75">{d}</span></span>
                  </li>
                ))}
              </ol>
              <CtaButton href="/cadastro" tone="gema" className="mt-8">Começar agora</CtaButton>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ planos */}
        <section id="planos" aria-labelledby="planos-t" className="mx-auto max-w-6xl px-4 py-20">
          <h2 id="planos-t" className="text-center font-brand text-4xl font-bold sm:text-5xl">Planos que cabem no bolso</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-tinta/70">O banco de questões e as resoluções são ilimitados em todos os planos. Os pagos liberam mais IA, simulados e exportações.</p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => {
              const featured = p.code === "estudante";
              return (
                <li key={p.code} className={`flex flex-col rounded-3xl border-2 bg-white p-6 ${featured ? "border-cobalto shadow-[0_20px_60px_rgba(47,60,255,.18)]" : "border-tinta/10"}`}>
                  {featured && <span className="mb-2 w-fit rounded-full bg-cobalto px-3 py-1 text-xs font-bold text-white">Mais escolhido</span>}
                  <h3 className="font-brand text-2xl font-bold">{p.name}</h3>
                  <p className="text-sm text-tinta/60">{p.tagline}</p>
                  <p className="mt-4"><span className="font-brand text-4xl font-bold">{p.priceCents ? brl(p.priceCents) : "R$ 0"}</span>{p.priceCents > 0 && <span className="text-tinta/60">/mês</span>}</p>
                  <p className="h-5 text-sm text-tinta/60">{p.priceYearCents ? `ou ${brl(p.priceYearCents)}/ano` : ""}</p>
                  <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
                    <li>✓ Questões e resoluções ilimitadas</li>
                    <li>✓ Simulados por prova: {describeLimit(p.limits.simulado)}</li>
                    <li>✓ Redação com IA: {describeLimit(p.limits.essay_ai)}</li>
                    <li>✓ Tutor IA: {describeLimit(p.limits.tutor_msg, "mensagens")}</li>
                    <li>✓ EPUB/PDF: {describeLimit(p.limits.export)}</li>
                    {p.limits.study_plan.quota !== 0 && <li>✓ Plano de estudos com IA</li>}
                    {p.code === "familia" && <li>✓ Até 4 contas</li>}
                  </ul>
                  <CtaButton href="/cadastro" size="md" tone={featured ? "primary" : "gema"} className="mt-6 w-full">{p.priceCents ? "Testar 7 dias grátis" : "Comece grátis"}</CtaButton>
                </li>
              );
            })}
          </ul>
          <p className="mt-6 text-center text-sm text-tinta/60">Toda conta nova começa com 7 dias de Pro. Os planos pagos estarão disponíveis em breve.</p>
        </section>

        {/* ------------------------------------------------ FAQ */}
        <section id="perguntas" aria-labelledby="faq-t" className="mx-auto max-w-3xl px-4 pb-20">
          <h2 id="faq-t" className="text-center font-brand text-4xl font-bold">Perguntas frequentes</h2>
          <div className="mt-8 flex flex-col gap-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group rounded-2xl border border-tinta/10 bg-white p-5 open:shadow-sm">
                <summary className="cursor-pointer list-none font-brand text-lg font-bold marker:hidden">
                  <span className="flex items-center justify-between gap-4">{q}<span className="text-cobalto transition-transform group-open:rotate-45" aria-hidden>+</span></span>
                </summary>
                <p className="mt-3 text-tinta/75">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------ CTA final */}
        <section className="mx-auto mb-20 max-w-6xl px-4">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-cobalto px-6 py-14 text-center text-white sm:px-12">
            <h2 className="font-brand text-4xl font-bold sm:text-5xl">Bora, tripulação?</h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-white/85">Crie sua conta grátis e faça sua primeira questão hoje.</p>
            <CtaButton href="/cadastro" tone="gema" size="lg" className="mt-8">Comece grátis</CtaButton>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
