import { cn } from "@/lib/utils";

export type Highlight = { quote: string; comment: string; criterion?: string; type?: "erro" | "acerto" | "sugestao" };

const TONE = {
  erro: "bg-danger-soft text-danger-soft-foreground decoration-danger",
  acerto: "bg-success-soft text-success-soft-foreground decoration-success",
  sugestao: "bg-warning-soft text-warning-soft-foreground decoration-[var(--area-humanas)]",
} as const;

/** Mostra o texto do aluno com os trechos comentados pela IA marcados e numerados (texto + cor + número). */
export function HighlightedText({ text, highlights }: { text: string; highlights: Highlight[] }) {
  // localiza cada trecho (primeira ocorrência livre), ignorando diferenças de espaço
  const spans: { start: number; end: number; idx: number }[] = [];
  highlights.forEach((h, idx) => {
    const pattern = h.quote.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const re = new RegExp(pattern, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const s = m.index, e = s + m[0].length;
      if (!spans.some((x) => s < x.end && e > x.start)) { spans.push({ start: s, end: e, idx }); break; }
    }
  });
  spans.sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let pos = 0;
  for (const sp of spans) {
    if (sp.start > pos) out.push(text.slice(pos, sp.start));
    const h = highlights[sp.idx];
    out.push(
      <mark key={sp.start} title={h.comment} className={cn("rounded px-0.5 underline decoration-2 underline-offset-4", TONE[h.type ?? "erro"])}>
        {text.slice(sp.start, sp.end)}<sup className="ml-0.5 font-bold">{sp.idx + 1}</sup>
      </mark>,
    );
    pos = sp.end;
  }
  out.push(text.slice(pos));
  return <div className="whitespace-pre-wrap text-base leading-8">{out}</div>;
}
