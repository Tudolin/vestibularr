"use client";

import { DEMO_FIELDS, type DemoField, type Demographics, UFS } from "@/lib/demographics";
import { cn } from "@/lib/utils";

const ORDER: DemoField[] = ["age_range", "gender", "school_type", "school_year", "referral"];

/** Perguntas opcionais "Sobre você". Tocar de novo numa opção desmarca. */
export function AboutYouFields({ value, onChange, tone = "app" }: { value: Demographics; onChange: (v: Demographics) => void; tone?: "app" | "brand" }) {
  const on = tone === "brand" ? "border-cobalto bg-cobalto/5 text-tinta" : "border-primary bg-primary-soft text-primary-soft-foreground";
  const off = tone === "brand" ? "border-tinta/10 bg-white text-tinta/80 hover:border-tinta/25" : "border-input bg-card text-foreground hover:bg-muted";
  const set = (k: keyof Demographics, v: string | null) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-5">
      {ORDER.map((k) => (
        <fieldset key={k} className="grid gap-2">
          <legend className="mb-1 text-sm font-bold">{DEMO_FIELDS[k].label}</legend>
          <div role="radiogroup" aria-label={DEMO_FIELDS[k].label} className="flex flex-wrap gap-2">
            {DEMO_FIELDS[k].options.map(([v, l]) => {
              const sel = value[k] === v;
              return (
                <button key={v} type="button" role="radio" aria-checked={sel} onClick={() => set(k, sel ? null : v)}
                  className={cn("min-h-11 rounded-full border-2 px-4 text-sm font-semibold transition-colors", sel ? on : off)}>
                  {l}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-bold">Onde você mora</legend>
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
          <select aria-label="Estado" value={value.state ?? ""} onChange={(e) => set("state", e.target.value || null)}
            className={cn("h-11 rounded-xl border-2 px-3 text-base", tone === "brand" ? "border-tinta/10 bg-white" : "border-input bg-card")}>
            <option value="">UF</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <input aria-label="Cidade" value={value.city ?? ""} maxLength={60} placeholder="Cidade" onChange={(e) => set("city", e.target.value || null)}
            className={cn("h-11 min-w-0 rounded-xl border-2 px-3 text-base outline-none", tone === "brand" ? "border-tinta/10 bg-white focus:border-cobalto" : "border-input bg-card focus:border-primary")} />
        </div>
      </fieldset>
    </div>
  );
}
