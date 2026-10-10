import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadExport } from "@/lib/export/load";
import { chapters, questionMeta } from "@/lib/export/types";
import { markdownToHtml } from "@/lib/markdown-html";
import { PrintToolbar } from "./toolbar";

// na impressão, figura com lazy-load pode sair em branco: aqui todas carregam de uma vez
const md = (s: string) => markdownToHtml(s).replaceAll('loading="lazy"', 'loading="eager"');

export const metadata: Metadata = { title: "Imprimir lista", robots: { index: false } };

/** Versão para imprimir ou salvar em PDF (pelo próprio navegador: funciona no iPhone, Android e PC). */
export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const c = await loadExport(id);
  if (!c) notFound();
  const answers = c.with_answers && c.questions.some((q) => q.correct_label || q.explanation_md);
  const date = new Date(c.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return (
    <div className="print-doc min-h-dvh bg-muted print:bg-white">
      <PrintToolbar id={c.id} title={c.title} count={c.questions.length} />
      <article className="mx-auto max-w-3xl bg-white px-5 py-8 text-[15px] leading-relaxed text-neutral-900 shadow-sm sm:px-10 print:max-w-none print:p-0 print:text-[10.5pt] print:shadow-none">
        <header className="mb-6 border-b-2 border-neutral-800 pb-3">
          <h1 className="font-display text-2xl font-extrabold">{c.title}</h1>
          <p className="text-sm text-neutral-600">{c.questions.length} questões{answers ? " · gabarito e resoluções no final" : ""} · Vestibularr · {date}</p>
        </header>

        {chapters(c.questions).map((cap) => (
          <section key={`${cap.title}-${cap.questions[0].n}`}>
            {cap.title !== "Questões" && <h2 className="mb-2 mt-6 border-b border-neutral-300 pb-1 text-lg font-bold">{cap.title}</h2>}
            {cap.questions.map((q) => (
              <div key={q.id} className="question border-b border-neutral-200 py-4">
                <p className="mb-1 text-[13px] font-bold">Questão {q.n} <span className="font-normal text-neutral-500">· {questionMeta(q)}</span></p>
                <div className="print-md" dangerouslySetInnerHTML={{ __html: md(q.statement_md) }} />
                {(q.images ?? []).filter((u) => !q.statement_md.includes(u)).map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element -- figuras de origens diversas, impressão simples
                  <img key={u} src={u} alt="figura da questão" className="mx-auto my-2 max-h-80 max-w-full" />
                ))}
                {q.alternatives.length > 0 && (
                  <ol className="alts mt-2 grid gap-1.5">
                    {q.alternatives.map((a) => (
                      <li key={a.label} className="flex gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-neutral-500 text-xs font-bold">{a.label}</span>
                        <span className="print-md min-w-0 flex-1">
                          <span dangerouslySetInnerHTML={{ __html: a.text_md ? md(a.text_md) : "" }} />
                          {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
                          {a.image_url && <img src={a.image_url} alt={`alternativa ${a.label}`} className="max-h-48 max-w-full" />}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </section>
        ))}

        {/* folha de respostas: marcar a caneta e depois lançar no app */}
        <section className="cartao break-before-page pt-6">
          <h2 className="mb-1 text-lg font-bold">Folha de respostas</h2>
          <p className="mb-3 text-sm text-neutral-600">Marque a caneta. Depois, em “Lançar respostas no app”, o Vestibularr corrige e atualiza seu desempenho.</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 print:grid-cols-4">
            {c.questions.map((q) => (
              <div key={q.id} className="flex items-center gap-1.5 text-sm">
                <span className="w-7 text-right font-bold tabular-nums">{q.n}</span>
                {(q.alternatives.length ? q.alternatives.map((a) => a.label) : ["A", "B", "C", "D", "E"]).map((l) => (
                  <span key={l} className="flex size-5 items-center justify-center rounded-full border border-neutral-500 text-[10px]">{l}</span>
                ))}
              </div>
            ))}
          </div>
        </section>

        {answers && (
          <section className="break-before-page pt-6">
            <h2 className="mb-3 text-lg font-bold">Gabarito</h2>
            <div className="grid grid-cols-5 gap-1 text-center text-sm sm:grid-cols-10">
              {c.questions.map((q) => (
                <a key={q.id} href={`#r${q.n}`} className="rounded border border-neutral-300 py-1"><span className="font-bold">{q.n}</span> {q.correct_label ?? "—"}</a>
              ))}
            </div>
            <h2 className="mb-2 mt-8 text-lg font-bold">Resoluções</h2>
            {c.questions.map((q) => (
              <div key={q.id} id={`r${q.n}`} className="question border-b border-neutral-200 py-3">
                <p className="mb-1 text-[13px] font-bold">Questão {q.n} — resposta {q.correct_label ?? "—"}</p>
                {q.explanation_md
                  ? <div className="print-md" dangerouslySetInnerHTML={{ __html: md(q.explanation_md) }} />
                  : <p className="text-sm italic text-neutral-500">Sem resolução comentada.</p>}
              </div>
            ))}
          </section>
        )}
      </article>
    </div>
  );
}
