import { BookOpenCheck, Bot, Check, CloudOff, Compass, FileText, Flame, Gauge, PenLine, Ship, Timer } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { CtaButton, SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { GUIDE_POSTER, GUIDE_VIDEO } from "@/lib/guide";
import { brl, describeLimit, PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: { absolute: "Vestibularr — sua vaga na federal não depende de quanto você pode pagar" },
  description: "Questões oficiais do ENEM e da UFPR com resolução, simulados, IA que corrige a redação e um desafio de 10 minutos por dia. Grátis para começar; o completo por um valor simbólico.",
  alternates: { canonical: "/" },
};

const RECURSOS = [
  {
    icon: Flame, kicker: "10 minutos por dia", title: "O desafio do dia transforma estudo em hábito",
    text: "Todo dia, 7 questões escolhidas para você: o assunto em que você mais erra, revisão dos erros e um chefão no final, com XP em dobro. Cada desafio leva seu navio a uma ilha do mapa do tesouro: com 5 na semana, o baú abre. Sequência de dias, escudos para os dias difíceis e nada de culpa.",
    img: "/landing/celular-desafio-feito-v2.webp", w: 780, h: 1688, alt: "Desafio do dia concluído: acertos, sequência de 7 dias e escudo ganho", phone: true,
  },
  {
    icon: Ship, kicker: "Tripulação", title: "Ninguém passa sozinho",
    text: "Chame os amigos da escola, monte uma tripulação e disputem a liga da semana. Mande um “vento a favor” para quem está desanimando. Sem chat aberto e sem nome real: só @apelido, avatar e XP.",
    img: "/landing/celular-tripulacao-v2.webp", w: 780, h: 1688, alt: "Tela da Tripulação com nível, sequência e a liga da semana", phone: true,
  },
  {
    icon: Timer, kicker: "Simulado de verdade", title: "Treine como no dia da prova",
    text: "O cronômetro roda no servidor: comece no celular e termine no computador. Cada marcação é salva sozinha e a prova continua funcionando sem internet.",
    img: "/landing/simulado.webp", w: 1440, h: 900, alt: "Tela de simulado com a questão, as alternativas e o mapa de questões", phone: false,
  },
  {
    icon: BookOpenCheck, kicker: "Treino com resolução", title: "Errou? Entenda o porquê na hora",
    text: "Toda questão do ENEM 2019–2024 tem resolução comentada: o raciocínio, a resposta e por que cada alternativa errada está errada. Conferida com o gabarito oficial do INEP.",
    img: "/landing/celular-resolucao-v2.webp", w: 780, h: 1688, alt: "Treino no celular mostrando 'Arr, acertou!' e o botão de ver a resolução", phone: true,
  },
  {
    icon: PenLine, kicker: "Redação com IA", title: "Nota por competência em minutos",
    text: "Escreva no app — o rascunho é salvo a cada palavra — ou mande a foto da folha. A IA corrige pelas 5 competências do ENEM (ou pela grade da UFPR) e marca os trechos.",
    img: "/landing/celular-redacao.webp", w: 780, h: 1688, alt: "Correção de redação no celular com nota por competência", phone: true,
  },
  {
    icon: Gauge, kicker: "Desempenho", title: "Saiba onde focar — e quanto falta para o seu curso",
    text: "Comece pela triagem: em 20 minutos, sua nota estimada por área com a TRI oficial do INEP. Depois, acertos por assunto, pontos fracos e quanto falta para o curso que você quer.",
    img: "/landing/desempenho-v2.webp", w: 1440, h: 900, alt: "Painel de desempenho com evolução, metas e cursos-alvo", phone: false,
  },
];

const MAIS = [
  { icon: Check, t: "Caderno de erros", d: "O que você errou volta em 1, 3, 7, 14 e 30 dias." },
  { icon: CloudOff, t: "Funciona sem internet", d: "Baixe treinos e redações; tudo sincroniza quando a internet volta. Celular simples também roda." },
  { icon: FileText, t: "PDF e EPUB", d: "Monte listas para imprimir, resolver no papel ou ler no Kindle, com gabarito." },
  { icon: Bot, t: "Tutor IA (em breve)", d: "Tire dúvidas de qualquer questão com um agente de IA que explica passo a passo." },
];

const FAQ = [
  ["As questões são oficiais?", "Sim. São das provas do ENEM (INEP) e da UFPR, com a fonte citada em cada questão. As resoluções comentadas são nossas e foram conferidas com o gabarito oficial."],
  ["Serve para a UTFPR e outras federais?", "Sim. A UTFPR e muitas outras usam a nota do ENEM pelo Sisu. Para a UFPR 2027 temos o formato próprio da fase única."],
  ["Funciona sem internet?", "Funciona. Instalado no celular, o simulado em andamento e a redação continuam offline; ao reconectar, tudo é enviado sozinho."],
  ["O Grátis é grátis mesmo?", "É, e vai continuar sendo: banco de questões e resoluções ilimitados, sem cartão. Estamos em beta e, por enquanto, todos os recursos estão liberados de graça para todo mundo."],
  ["Por que é tão barato?", "Porque esse é o motivo de o Vestibularr existir: a vaga na universidade pública não pode depender de quanto a família consegue pagar. Quando os planos pagos começarem, o completo vai custar R$ 9,90 por mês, e quem não puder pagar continua estudando no Grátis."],
  ["Posso cancelar quando quiser?", "Pode, pelo site, a qualquer momento. O acesso pago segue até o fim do período já pago, e você tem 7 dias de arrependimento com reembolso integral."],
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
      <main id="conteudo" className="marca-clara overflow-x-clip bg-creme text-tinta">
        {/* ------------------------------------------------ hero */}
        <section className="relative">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 md:grid-cols-[1.15fr_1fr] md:pt-16">
            <div className="flex flex-col gap-6">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-gema/30 px-3 py-1 text-sm font-bold text-tinta">ENEM · UFPR 2027 · UTFPR via Sisu</span>
              <h1 className="font-brand text-[2.6rem] font-bold leading-[1.02] tracking-tight sm:text-6xl">
                Sua vaga na federal <span className="text-cobalto">não depende de quanto você pode pagar.</span>
              </h1>
              <p className="max-w-xl text-lg text-tinta/75">
                Um app para estudar do seu jeito, onde e quando quiser: questões oficiais do ENEM e da UFPR com resolução,
                simulados, IA que ajuda na estrutura da sua redação e mostra seus pontos fortes e fracos. Grátis para começar.
              </p>
              <div className="flex flex-wrap gap-3">
                <CtaButton href="/cadastro" size="lg">Comece grátis</CtaButton>
                <a href="#video" className="inline-flex min-h-14 items-center rounded-2xl px-5 font-brand text-xl font-bold text-cobalto hover:bg-cobalto/5">▶ Ver em 2 minutos</a>
              </div>
              <p className="text-sm text-tinta/60">Em beta: tudo liberado de graça · sem cartão</p>
            </div>
            <div className="relative">
              <PhoneShot src="/landing/celular-desafio-v2.webp" alt="Tela inicial do app com o desafio do dia, a sequência e os escudos" />
              {/* eslint-disable-next-line @next/next/no-img-element -- mascote SVG */}
              <img src="/brand/grafite-deitado.svg" alt="Mascote do Vestibularr: um gato pirata deitado segurando um lápis" width={600} height={268} className="absolute -bottom-20 left-1/2 w-[min(420px,92vw)] -translate-x-1/2 drop-shadow-[0_10px_0_rgba(20,18,58,.08)]" />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ números */}
        <section aria-label="Em números" className="bg-cobalto text-white">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4">
            {[["R$ 0", "para começar, com questões e resoluções ilimitadas"], ["1.088", "questões do ENEM 2019–2024 com resolução comentada"], ["10 min", "por dia no desafio: o hábito que leva à vaga"], ["100%", "do progresso salvo sozinho, até sem internet"]].map(([n, d]) => (
              <div key={n} className="flex flex-col gap-1">
                <dt className="sr-only">{d}</dt>
                <dd className="font-brand text-4xl font-bold sm:text-5xl">{n}</dd>
                <dd className="text-sm text-white/80">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ------------------------------------------------ por que existimos */}
        <section id="por-que" aria-labelledby="porque-t" className="mx-auto max-w-3xl px-4 pt-20 text-center">
          <span className="inline-flex items-center gap-2 font-brand text-lg font-bold text-cobalto"><Compass className="size-5" aria-hidden /> Por que o Vestibularr existe</span>
          <h2 id="porque-t" className="mt-3 font-brand text-4xl font-bold leading-tight sm:text-5xl">A faculdade mudou a minha vida. Agora é a sua vez.</h2>
          <blockquote className="mt-6 text-left text-lg leading-relaxed text-tinta/80 sm:text-center">
            <p>
              Nasci numa família humilde e estudei em colégio público. Foi a faculdade que mudou a minha vida e a minha educação.
              Mas eu sei quantos colegas ficaram pelo caminho porque não tinham como pagar por ajuda para estudar.
            </p>
            <p className="mt-4">
              Criei o Vestibularr para incentivar e ajudar quem está nessa: um jeito mais prático de estudar, no celular, onde e
              como você quiser, com simulados, a resolução de cada questão e IA que ajuda na estrutura da redação e mostra onde
              você está forte e onde precisa melhorar. De graça para começar, e com um valor acessível para ter tudo.
            </p>
            <footer className="mt-5 font-brand text-base font-bold text-tinta">— Fundador do Vestibularr</footer>
          </blockquote>
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
                {[["Crie sua conta grátis", "Em menos de um minuto, sem cartão."], ["Descubra seu nível", "A triagem estima sua nota por área com a TRI do INEP e mostra onde focar."], ["10 minutos por dia", "Desafio do dia, revisão dos erros na hora certa e simulados no fim de semana, com a sua tripulação."]].map(([t, d], i) => (
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
          <h2 id="planos-t" className="text-center font-brand text-4xl font-bold sm:text-5xl">Preço simbólico, de propósito</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-lg text-tinta/70">
            Quem não pode pagar estuda no Grátis, com questões e resoluções ilimitadas, para sempre. Os planos pagos liberam mais IA,
            simulados e exportações por menos que um lanche por mês.
          </p>
          <p className="mx-auto mt-4 w-fit rounded-full bg-gema/30 px-4 py-1.5 text-center text-sm font-bold">Em beta: por enquanto, tudo liberado de graça para todo mundo</p>
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
                    {p.limits.study_plan.quota !== 0 && <li>✓ Plano de estudos (em breve)</li>}
                    {p.code === "familia" && <li>✓ Até 4 contas</li>}
                  </ul>
                  <CtaButton href="/cadastro" size="md" tone={featured ? "primary" : "gema"} className="mt-6 w-full">Comece grátis</CtaButton>
                </li>
              );
            })}
          </ul>
          <p className="mt-6 text-center text-sm text-tinta/60">Os planos pagos chegam depois do beta, com pagamento pelo site. Desafio do dia, sequência e Tripulação são grátis em todos os planos.</p>
        </section>

        {/* ------------------------------------------------ FAQ */}
        <section id="perguntas" aria-labelledby="faq-t" className="mx-auto max-w-3xl px-4 pb-20">
          <h2 id="faq-t" className="text-center font-brand text-4xl font-bold">Perguntas frequentes</h2>
          <div className="mt-8 flex flex-col gap-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group rounded-2xl border border-tinta/10 bg-white p-5 open:shadow-sm">
                <summary className="flex min-h-11 cursor-pointer list-none items-center font-brand text-lg font-bold marker:hidden">
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
            <h2 className="font-brand text-4xl font-bold sm:text-5xl">Agora é a sua vez.</h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-white/85">Crie sua conta grátis e faça o seu primeiro desafio hoje. São 10 minutos. Bora, tripulação?</p>
            <CtaButton href="/cadastro" tone="gema" size="lg" className="mt-8">Comece grátis</CtaButton>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
