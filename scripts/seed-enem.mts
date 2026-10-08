/**
 * Seed de questões do ENEM: 2009–2023 pela API pública enem.dev e 2024 pelo dataset
 * maritaca-ai/enem (Hugging Face, licença Apache-2.0). ENEM 2025: sem fonte aberta; ver README.
 * Os dados NÃO ficam no repositório: são baixados na hora e enviados via RPC import_bundle
 * (idempotente: rodar de novo atualiza, não duplica).
 *
 *   npm run seed:enem                      # envia ao Supabase (precisa de .env.local com service-role)
 *   npm run seed:enem -- --years 2022,2023 # só alguns anos
 *   npm run seed:enem -- --out /tmp/enem.json   # só baixa e salva o bundle (sem banco)
 *
 * 2024: a fonte só traz a versão de INGLÊS da língua estrangeira (questões 1–5) e a questão 124 está anulada.
 * Observações: a API informa a ÁREA (não a disciplina/assunto) e não traz resolução comentada.
 * Questões anuladas (sem gabarito) são puladas e listadas no final.
 */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { validateBundle, type questionSchema } from "../src/lib/import/schema";

type QuestionInput = z.input<typeof questionSchema>;
type ExamInput = { name: string; year: number; day: string; format: string; questions: QuestionInput[] };

const API = "https://api.enem.dev/v1";
const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const outFile = opt("out");
const onlyYears = opt("years")?.split(",").map(Number);

type ApiQuestion = {
  index: number;
  discipline: string;
  language: string | null;
  year: number;
  context: string | null;
  files: string[];
  correctAlternative: string | null;
  alternativesIntroduction: string | null;
  alternatives: { letter: string; text: string | null; file: string | null }[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET com espaçamento entre chamadas e backoff em 429/5xx (a API pública limita a taxa). */
async function getJson<T>(url: string, tries = 7): Promise<T> {
  await sleep(350);
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { fatal: true });
      return (await res.json()) as T;
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal || i >= tries - 1) throw new Error(`${url}: ${(e as Error).message}`);
      await sleep(4000 * 2 ** i);
    }
  }
}

async function fetchYear(year: number): Promise<ApiQuestion[]> {
  const byKey = new Map<string, ApiQuestion>();
  // Cada filtro de idioma devolve a prova inteira naquele idioma; a união cobre tudo.
  // Anos antigos podem não ter idiomas cadastrados (o filtro dá HTTP 400): uma passada sem filtro.
  const meta = await getJson<{ languages?: { value: string }[] }>(`${API}/exams/${year}`);
  const langs: (string | undefined)[] = meta.languages?.length ? meta.languages.map((l) => l.value) : [undefined];
  for (const lang of langs) {
    for (let offset = 0; ; offset += 50) {
      const url = `${API}/exams/${year}/questions?limit=50&offset=${offset}${lang ? `&language=${lang}` : ""}`;
      const page = await getJson<{ metadata: { hasMore: boolean }; questions: ApiQuestion[] }>(url);
      for (const q of page.questions) byKey.set(`${q.index}|${q.language ?? ""}`, q);
      if (!page.metadata.hasMore) break;
    }
  }
  return [...byKey.values()].sort((a, b) => a.index - b.index);
}

const MARITACA_YEARS = [2024];
const MARITACA_URL = (y: number) => `https://huggingface.co/datasets/maritaca-ai/enem/resolve/main/${y}.jsonl`;
type MaritacaRow = { id: string; question: string; alternatives: string[]; label: string; figures: string[]; description: string[] };

/** Normaliza o formato do dataset maritaca para o mesmo formato da API, para reaproveitar o pipeline. */
async function fetchMaritaca(year: number): Promise<ApiQuestion[]> {
  await sleep(350);
  const res = await fetch(MARITACA_URL(year));
  if (!res.ok) throw new Error(`maritaca ${year}: HTTP ${res.status}`);
  const rows = (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l) as MaritacaRow);
  const alt = (d?: string) => (d ?? "").replace(/^Descrição[^:]*:\s*/i, "").replace(/[\[\]\n]+/g, " ").trim().slice(0, 300) || "figura";
  return rows.map((r) => {
    // As figuras vêm em ordem: primeiro as do enunciado ([[placeholder]]), depois uma por alternativa-imagem.
    let fi = 0;
    const next = () => {
      const i = fi++;
      return r.figures[i] ? { url: r.figures[i], alt: alt(r.description?.[i]) } : null;
    };
    const statement = r.question.replace(/\[\[placeholder\]\]/g, () => {
      const f = next();
      return f ? `\n\n![${f.alt}](${f.url})\n\n` : "";
    });
    const alternatives = r.alternatives.map((text, i) => {
      const isImg = /\[\[placeholder\]\]/.test(text);
      const f = isImg ? next() : null;
      return { letter: "ABCDE"[i], text: isImg ? "" : text, file: f?.url ?? null };
    });
    const index = Number(r.id.replace(/\D/g, ""));
    return {
      index,
      discipline: "",
      language: index <= 5 ? "ingles" : null, // 1–5 = língua estrangeira (a fonte só tem inglês)
      year,
      context: statement.trim(),
      files: [],
      correctAlternative: /^[A-E]$/.test(r.label) ? r.label : null,
      alternativesIntroduction: null,
      alternatives,
    };
  });
}

const AREA: Record<string, "linguagens" | "humanas" | "natureza" | "matematica"> = {
  linguagens: "linguagens",
  "ciencias-humanas": "humanas",
  "ciencias-natureza": "natureza",
  matematica: "matematica",
};

/**
 * A API às vezes rotula a área errada, então a área vem da POSIÇÃO oficial na prova (blocos de 45):
 * desde 2017: 1–45 Linguagens (1–5 = língua estrangeira), 46–90 Humanas, 91–135 Natureza, 136–180 Matemática.
 * Até 2016: 1–45 Humanas, 46–90 Natureza, 91–135 Linguagens (91–95 = língua estrangeira), 136–180 Matemática.
 */
function areaByPosition(year: number, index: number): "linguagens" | "humanas" | "natureza" | "matematica" | null {
  if (index < 1 || index > 180) return null;
  const block = Math.floor((index - 1) / 45);
  const order = year >= 2017 ? (["linguagens", "humanas", "natureza", "matematica"] as const) : (["humanas", "natureza", "linguagens", "matematica"] as const);
  return order[block];
}

/** Até 2016: dia 1 = Humanas+Natureza. Desde 2017: dia 1 = Linguagens+Humanas. */
function dayOf(year: number, area: string): 1 | 2 {
  const day1 = year >= 2017 ? ["linguagens", "humanas"] : ["humanas", "natureza"];
  return day1.includes(area) ? 1 : 2;
}
const formatOf = (year: number, day: 1 | 2) => (year >= 2017 ? `ENEM_dia${day}` : `ENEM_antigo_dia${day}`);

const BROKEN = /!\[[^\]]*\]\(https:\/\/enem\.dev\/broken-image\.svg\)/g;
const imageUrls = (md: string) => [...md.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => m[1]);

const skipped: string[] = [];
let mislabeled = 0;
const years = (onlyYears ?? [...(await getJson<{ year: number }[]>(`${API}/exams`)).map((e) => e.year), ...MARITACA_YEARS]).sort();
const exams: ExamInput[] = [];

for (const year of years) {
  const list = MARITACA_YEARS.includes(year) ? await fetchMaritaca(year) : await fetchYear(year);
  const byDay = new Map<1 | 2, QuestionInput[]>();
  for (const q of list) {
    const area = areaByPosition(year, q.index);
    if (!area) { skipped.push(`${year} #${q.index}: posição fora de 1–180`); continue; }
    if (q.discipline && AREA[q.discipline] !== area) mislabeled++;
    if (!q.correctAlternative) { skipped.push(`${year} #${q.index}: sem gabarito (anulada?)`); continue; }
    const statement = [q.context, q.alternativesIntroduction].filter(Boolean).join("\n\n").replace(BROKEN, "*[imagem indisponível na fonte]*");
    const day = dayOf(year, area);
    const arr = byDay.get(day) ?? [];
    arr.push({
      number: q.index,
      kind: "objective",
      area,
      language: (q.language as "ingles" | "espanhol" | null) ?? undefined,
      statement_md: statement || "(enunciado em imagem)",
      images: [...new Set([...q.files, ...imageUrls(statement)])].filter((u) => !u.includes("broken-image")),
      alternatives: q.alternatives.map((a) => ({
        label: a.letter as "A" | "B" | "C" | "D" | "E",
        text_md: (a.text ?? "").replace(BROKEN, "*[imagem indisponível na fonte]*"),
        image_url: a.file ?? undefined,
      })),
      correct: q.correctAlternative as "A" | "B" | "C" | "D" | "E",
      external_id: `${MARITACA_YEARS.includes(year) ? "maritaca" : "enem.dev"}:${year}:${q.index}:${q.language ?? "-"}`,
      source_ref: MARITACA_YEARS.includes(year) ? "https://huggingface.co/datasets/maritaca-ai/enem" : `https://enem.dev/${year}`,
    });
    byDay.set(day, arr);
  }
  for (const [day, questions] of byDay) {
    exams.push({ name: `ENEM ${year} — Dia ${day}`, year, day: String(day), format: formatOf(year, day), questions });
  }
  // Cobertura: cada área deve ter 45 questões (+5 por idioma de língua estrangeira).
  const all = [...byDay.values()].flat();
  const cov = (["linguagens", "humanas", "natureza", "matematica"] as const)
    .map((a) => `${a.slice(0, 3)} ${new Set(all.filter((q) => q.area === a && !q.language).map((q) => q.number)).size}`)
    .join(" · ");
  const lem = (l: string) => all.filter((q) => q.language === l).length;
  console.log(`${year}: ${list.length} baixadas | sem idioma: ${cov} | inglês ${lem("ingles")}/5 · espanhol ${lem("espanhol")}/5`);
}

const check = validateBundle({ version: 1, board: "ENEM", exams, questions: [] });
console.log(`\nÁrea da API divergente da posição oficial em ${mislabeled} questões (usada a posição).`);
console.log(`Validação: ${check.summary.questions} válidas, ${check.summary.invalid} inválidas`);
check.issues.slice(0, 15).forEach((i) => console.log(`  ! ${i.where}: ${i.message}`));
if (skipped.length) console.log(`Puladas (${skipped.length}):\n  ${skipped.slice(0, 20).join("\n  ")}${skipped.length > 20 ? "\n  …" : ""}`);

if (outFile) {
  writeFileSync(outFile, JSON.stringify(check.bundle));
  console.log(`Bundle salvo em ${outFile}`);
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env.local) ou use --out.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });
let inserted = 0, updated = 0;
for (const exam of check.bundle!.exams) {
  for (let i = 0; i < exam.questions.length; i += 40) {
    const chunk = { ...exam, questions: exam.questions.slice(i, i + 40) };
    const { data, error } = await supabase.rpc("import_bundle", { p: { board: "ENEM", exams: [chunk] } });
    if (error) throw new Error(`${exam.name}: ${error.message}`);
    inserted += data.inserted;
    updated += data.updated;
  }
  console.log(`✔ ${exam.name}: ${exam.questions.length}`);
}
console.log(`\nConcluído: ${inserted} inseridas, ${updated} atualizadas.`);
