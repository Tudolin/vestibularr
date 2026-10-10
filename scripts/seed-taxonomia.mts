/**
 * Grava em cada questão do ENEM o assunto (data/taxonomia/enem-<ano>.json) e os dados oficiais do INEP
 * (data/inep/enem-<ano>.json: habilidade da Matriz e parâmetros TRI). Rodar de novo é seguro.
 *
 *   npm run seed:taxonomia                  # todos os anos
 *   npm run seed:taxonomia -- --years 2023  # só alguns anos
 *
 * Os arquivos do INEP são gerados por scripts/inep-itens.py a partir dos microdados (ITENS_PROVA_<ano>.csv).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import taxonomy from "../data/taxonomia/taxonomia.json" with { type: "json" };

const lang = z.enum(["ingles", "espanhol"]).optional();
const taxFile = z.object({
  year: z.number().int(),
  items: z.array(z.object({ number: z.number().int().positive(), language: lang, subject: z.string(), topic: z.string() })),
});
const inepFile = z.object({
  year: z.number().int(),
  items: z.array(
    z.object({
      number: z.number().int().positive(),
      language: lang,
      skill: z.number().int().min(1).max(30).nullable(),
      item: z.number().int(),
      irt: z.object({ a: z.number(), b: z.number(), c: z.number() }).nullable(),
    }),
  ),
});

const valid = new Set(
  Object.entries(taxonomy as Record<string, unknown>)
    .filter(([k]) => !k.startsWith("_"))
    .flatMap(([, subjects]) => Object.entries(subjects as Record<string, string[]>).flatMap(([s, ts]) => ts.map((t) => `${s}›${t}`))),
);

const args = process.argv.slice(2);
const i = args.indexOf("--years");
const years = i >= 0 ? args[i + 1].split(",").map(Number) : [2019, 2020, 2021, 2022, 2023, 2024];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });
const root = join(import.meta.dirname, "..", "data");

for (const year of years) {
  const items = new Map<string, Record<string, unknown>>();
  const k = (n: number, l?: string) => `${n}|${l ?? ""}`;
  const inepPath = join(root, "inep", `enem-${year}.json`);
  if (existsSync(inepPath)) {
    for (const it of inepFile.parse(JSON.parse(readFileSync(inepPath, "utf8"))).items)
      items.set(k(it.number, it.language), { number: it.number, language: it.language, skill: it.skill, irt: it.irt, item: it.item });
  }
  const taxPath = join(root, "taxonomia", `enem-${year}.json`);
  if (existsSync(taxPath)) {
    for (const it of taxFile.parse(JSON.parse(readFileSync(taxPath, "utf8"))).items) {
      if (!valid.has(`${it.subject}›${it.topic}`)) throw new Error(`${year} q${it.number}: assunto fora da taxonomia (${it.subject} › ${it.topic})`);
      items.set(k(it.number, it.language), { ...items.get(k(it.number, it.language)), number: it.number, language: it.language, subject: it.subject, topic: it.topic });
    }
  }
  if (!items.size) continue;
  const { data, error } = await supabase.rpc("apply_taxonomy", { p: { board: "ENEM", year, items: [...items.values()] } });
  if (error) {
    console.error(`${year}: ${error.message}`);
    process.exitCode = 1;
    continue;
  }
  const r = data as { updated: number; missing: string[] };
  console.log(`ENEM ${year}: ${r.updated} questões atualizadas`);
  // os itens do INEP cobrem as 180 posições (e as duas línguas); as que não estão no banco são esperadas
  if (r.missing.length) console.log(`  fora do banco (ok se forem anuladas ou não importadas): ${r.missing.length}`);
}
