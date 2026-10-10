"use client";

import { ArrowLeft, Check, Loader2, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { finishOnboardingAction } from "./actions";
import { AboutYouFields } from "@/components/account/about-you-fields";
import type { Demographics } from "@/lib/demographics";

type Course = { id: string; label: string };

const STEPS = ["Vestibular", "Curso", "Sobre você", "Meta"] as const;
const META = [
  { n: 10, t: "Leve", d: "10 questões por dia" },
  { n: 20, t: "Firme", d: "20 questões por dia" },
  { n: 40, t: "Intenso", d: "40 questões por dia" },
  { n: 60, t: "Modo pirata", d: "60 questões por dia" },
];

const choice = (on: boolean) =>
  cn("flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 px-5 py-3 text-left font-semibold transition-colors",
    on ? "border-cobalto bg-cobalto/5 text-tinta" : "border-tinta/10 bg-white text-tinta/80 hover:border-tinta/25");

export function OnboardingWizard({ name, courses }: { name: string; courses: Course[] }) {
  const [step, setStep] = useState(0);
  const [boards, setBoards] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [meta, setMeta] = useState(20);
  const [about, setAbout] = useState<Demographics>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? courses.filter((c) => c.label.toLowerCase().includes(t)) : courses).slice(0, 40);
  }, [q, courses]);
  const toggle = (arr: string[], v: string, set: (x: string[]) => void, max = 99) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : arr.length < max ? [...arr, v] : arr);

  const next = () => {
    setError(null);
    if (step === 0 && boards.length === 0) return setError("Escolha ao menos um vestibular.");
    if (step < 3) return setStep(step + 1);
    start(async () => {
      const r = await finishOnboardingAction({ boards, courses: picked, questionsDay: meta, about });
      if (r && !r.ok) setError(r.error);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex gap-2" aria-label="Etapas">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={cn("h-2 rounded-full", i <= step ? "bg-cobalto" : "bg-tinta/10")} />
            <span className={cn("mt-1 block text-xs font-semibold", i === step ? "text-cobalto" : "text-tinta/65")} aria-current={i === step ? "step" : undefined}>{s}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="t0">
          <h1 id="t0" className="font-brand text-3xl font-bold text-tinta">Oi, {name.split(" ")[0] || "pirata"}! Pra qual prova você está estudando?</h1>
          <p className="text-tinta/70">Pode marcar os dois. Isso ajusta os simulados e a nota estimada.</p>
          {[["ENEM", "ENEM", "Também vale para UTFPR e outras via Sisu"], ["UFPR", "UFPR 2027", "Fase única com 80 objetivas + discursivas"]].map(([v, t, d]) => (
            <button key={v} type="button" aria-pressed={boards.includes(v)} onClick={() => toggle(boards, v, setBoards)} className={choice(boards.includes(v))}>
              <span><span className="block font-brand text-xl">{t}</span><span className="block text-sm font-normal text-tinta/60">{d}</span></span>
              {boards.includes(v) && <Check className="text-cobalto" aria-hidden />}
            </button>
          ))}
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-3" aria-labelledby="t1">
          <h1 id="t1" className="font-brand text-3xl font-bold text-tinta">Qual curso você quer?</h1>
          <p className="text-tinta/70">Escolha até 6. Mostramos a nota estimada para cada um. Pode pular e escolher depois.</p>
          <label className="relative">
            <span className="sr-only">Buscar curso</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-tinta/40" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: Medicina, Direito, Computação…" className="h-12 w-full rounded-2xl border-2 border-tinta/10 bg-white pl-12 pr-4 text-base outline-none focus:border-cobalto" />
          </label>
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
            {filtered.map((c) => (
              <li key={c.id}>
                <button type="button" aria-pressed={picked.includes(c.id)} onClick={() => toggle(picked, c.id, setPicked, 6)} className={cn(choice(picked.includes(c.id)), "min-h-12 py-2 text-sm")}>
                  {c.label}
                  {picked.includes(c.id) && <Check className="size-5 shrink-0 text-cobalto" aria-hidden />}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="text-sm text-tinta/60">Nenhum curso com esse nome.</li>}
          </ul>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-3" aria-labelledby="ts">
          <h1 id="ts" className="font-brand text-3xl font-bold text-tinta">Conta um pouco sobre você?</h1>
          <p className="text-tinta/70">
            Tudo opcional. Ninguém mais vê: usamos só em números gerais para entender quem estuda com a gente e melhorar o app.
            Dá para mudar ou apagar no Perfil.
          </p>
          <AboutYouFields value={about} onChange={setAbout} tone="brand" />
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-col gap-3" aria-labelledby="t2">
          <h1 id="t2" className="font-brand text-3xl font-bold text-tinta">Qual o seu ritmo?</h1>
          <p className="text-tinta/70">Sua meta diária. Dá para mudar quando quiser no Desempenho.</p>
          <div className="grid grid-cols-2 gap-3">
            {META.map((m) => (
              <button key={m.n} type="button" aria-pressed={meta === m.n} onClick={() => setMeta(m.n)} className={cn(choice(meta === m.n), "flex-col items-start")}>
                <span className="font-brand text-xl">{m.t}</span>
                <span className="text-sm font-normal text-tinta/60">{m.d}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {error && <p role="alert" className="text-sm font-semibold text-coral">{error}</p>}
      <div className="flex items-center gap-3">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className="inline-flex min-h-12 items-center gap-1 rounded-2xl px-4 font-semibold text-tinta/70 hover:bg-tinta/5">
            <ArrowLeft className="size-4" aria-hidden /> Voltar
          </button>
        )}
        <button type="button" onClick={next} disabled={pending} className="ml-auto inline-flex min-h-13 items-center gap-2 rounded-2xl bg-cobalto px-8 font-brand text-xl font-bold text-white shadow-[0_4px_0_var(--color-cobalto-escuro)] active:translate-y-0.5 disabled:opacity-70">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {step < 3 ? ((step === 1 && picked.length === 0) || (step === 2 && !Object.values(about).some(Boolean)) ? "Pular" : "Continuar") : "Começar a estudar"}
        </button>
      </div>
    </div>
  );
}
