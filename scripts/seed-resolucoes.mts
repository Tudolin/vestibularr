/**
 * Aplica as resoluções comentadas de data/resolucoes/*.json em answer_keys.explanation_md.
 * Cada arquivo: { board, year, items: [{ number, language?, correct, explanation_md, ...correções }] }.
 * Correções conferidas no PDF oficial do INEP (opcionais por item): statement_md/alternatives (texto e figuras
 * corrigidos; figuras em public/questoes/), override_correct (gabarito da fonte estava errado) e annulled (anulada).
 * A RPC apply_explanations só grava a resolução quando o gabarito bate com o do banco;
 * as divergências e as questões não encontradas são listadas no final. Rodar de novo é seguro.
 *
 *   npm run seed:resolucoes                  # todos os arquivos
 *   npm run seed:resolucoes -- --years 2023  # só alguns anos
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const fileSchema = z.object({
  board: z.enum(["ENEM", "UFPR"]),
  year: z.number().int(),
  items: z.array(
    z.union([
      z.object({ number: z.number().int().positive(), language: z.enum(["ingles", "espanhol"]).optional(), annulled: z.literal(true) }),
      z.object({
        number: z.number().int().positive(),
        language: z.enum(["ingles", "espanhol"]).optional(),
        correct: z.enum(["A", "B", "C", "D", "E"]),
        explanation_md: z.string().trim().min(20).max(20000),
        override_correct: z.boolean().optional(),
        statement_md: z.string().trim().min(1).max(60000).optional(),
        alternatives: z
          .array(z.object({ label: z.enum(["A", "B", "C", "D", "E"]), text_md: z.string().max(5000), image_url: z.string().nullable() }))
          .length(5)
          .optional(),
      }),
    ]),
  ),
});

const args = process.argv.slice(2);
const i = args.indexOf("--years");
const onlyYears = i >= 0 ? args[i + 1]?.split(",").map(Number) : undefined;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const dir = join(import.meta.dirname, "..", "data", "resolucoes");
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
let total = 0;
for (const f of files) {
  const parsed = fileSchema.safeParse(JSON.parse(readFileSync(join(dir, f), "utf8")));
  if (!parsed.success) {
    console.error(`${f}: arquivo inválido — ${parsed.error.issues.slice(0, 3).map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
    process.exitCode = 1;
    continue;
  }
  const { board, year, items } = parsed.data;
  if (onlyYears && !onlyYears.includes(year)) continue;
  const { data, error } = await supabase.rpc("apply_explanations", { p: { board, year, items } });
  if (error) {
    console.error(`${f}: ${error.message}`);
    process.exitCode = 1;
    continue;
  }
  const r = data as { updated: number; fixed: number; annulled: number; missing: string[]; mismatch: string[] };
  total += r.updated;
  const withExpl = items.filter((i) => "explanation_md" in i).length;
  console.log(`${f}: ${r.updated}/${withExpl} resoluções gravadas · ${r.fixed} questões corrigidas · ${r.annulled} anuladas`);
  if (r.missing.length) console.log(`  não encontradas no banco (rode o seed:enem deste ano): ${r.missing.join(", ")}`);
  if (r.mismatch.length) console.log(`  gabarito divergente (puladas): ${r.mismatch.join(", ")}`);
}
console.log(`Total: ${total} resoluções gravadas.`);
