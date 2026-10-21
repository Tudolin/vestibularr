/**
 * Importa as provas do NC/UFPR extraídas do PDF oficial (scripts/ufpr-provas.py):
 *   data/ufpr/ufpr-<ano>.json            vestibular da UFPR (1ª fase, 7 línguas estrangeiras)
 *   data/concursos/<slug>.json           concursos de nível médio (questões comuns ligadas a todos os cargos)
 *   data/fuvest/fuvest-<ano>.json        1ª fase da Fuvest (USP), 90 questões de A a E
 *   data/unicamp/unicamp-<ano>.json      1ª fase da Unicamp (Comvest), 72 questões de A a D
 * junto com as resoluções comentadas e a classificação (matéria/assunto) de
 *   data/ufpr/resolucoes/ufpr-<ano>.json e data/concursos/resolucoes/<slug>.json
 * ({ items: [{ external_id, correct, area?, subject, topic, explanation_md }] }).
 * Correções de extração conferidas no PDF: data/ufpr/correcoes.json e data/concursos/correcoes.json.
 * A resolução só entra quando o gabarito dela bate com o do caderno oficial. Rodar de novo é seguro (atualiza).
 *
 *   npm run seed:provas                     # tudo
 *   npm run seed:provas -- --only ufpr-2025 # só um arquivo
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import taxonomy from "../data/taxonomia/taxonomia.json" with { type: "json" };
import { validateBundle } from "../src/lib/import/schema";

const resFile = z.object({
  items: z.array(
    z.object({
      external_id: z.string(),
      correct: z.enum(["A", "B", "C", "D", "E"]),
      area: z.enum(["linguagens", "humanas", "natureza", "matematica"]).optional(),
      subject: z.string().min(1).max(120),
      topic: z.string().min(1).max(120),
      explanation_md: z.string().trim().min(20).max(20000),
    }),
  ),
});

// Correções conferidas no PDF oficial (quando a extração automática falha): data/<dir>/correcoes.json
// { "<external_id>": { statement_md?, alternatives?: [{ label, text_md, image_url? }] } }
const fixFile = z.record(
  z.string(),
  z.object({
    statement_md: z.string().trim().min(1).max(60000).optional(),
    alternatives: z.array(z.object({ label: z.enum(["A", "B", "C", "D", "E"]), text_md: z.string().max(5000), image_url: z.string().optional() })).min(4).max(5).optional(),
    note: z.string().optional(),
  }),
);

// matéria › assunto válidos para o vestibular (mesma taxonomia do ENEM)
const areaOf = new Map<string, string>();
const validTopic = new Set<string>();
for (const [area, subjects] of Object.entries(taxonomy as Record<string, unknown>)) {
  if (area.startsWith("_")) continue;
  for (const [subject, topics] of Object.entries(subjects as Record<string, string[]>)) {
    areaOf.set(subject, area);
    for (const t of topics) validTopic.add(`${subject}›${t}`);
  }
}

const args = process.argv.slice(2);
const i = args.indexOf("--only");
const only = i >= 0 ? args[i + 1]?.split(",") : undefined;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const root = join(import.meta.dirname, "..", "data");
const sources = ["ufpr", "fuvest", "unicamp", "concursos"].filter((dir) => existsSync(join(root, dir))).flatMap((dir) =>
  readdirSync(join(root, dir))
    .filter((f) => f.endsWith(".json") && f !== "correcoes.json")
    .sort()
    .map((f) => ({ dir, name: f.replace(/\.json$/, "") })),
);

let total = 0;
for (const { dir, name } of sources) {
  if (only && !only.includes(name)) continue;
  const raw = JSON.parse(readFileSync(join(root, dir, `${name}.json`), "utf8"));
  const resPath = join(root, dir, "resolucoes", `${name}.json`);
  const res = new Map(existsSync(resPath) ? resFile.parse(JSON.parse(readFileSync(resPath, "utf8"))).items.map((r) => [r.external_id, r]) : []);
  const fixPath = join(root, dir, "correcoes.json");
  const fixes = existsSync(fixPath) ? fixFile.parse(JSON.parse(readFileSync(fixPath, "utf8"))) : {};
  const vestibular = raw.board !== "CONCURSO";
  const mismatch: string[] = [];
  const badTopic: string[] = [];
  const solved = new Set<string>();

  for (const exam of raw.exams) {
    for (const q of exam.questions) {
      const fix = fixes[q.external_id];
      if (fix?.statement_md) q.statement_md = fix.statement_md;
      if (fix?.alternatives) q.alternatives = fix.alternatives;
      if (fix?.statement_md || fix?.alternatives) {
        const urls = [q.statement_md, ...q.alternatives.map((a: { image_url?: string }) => a.image_url ?? "")].join(" ");
        q.images = (q.images as string[]).filter((u) => urls.includes(u));
      }
      const r = res.get(q.external_id);
      if (!r) continue;
      if (r.correct !== q.correct) {
        mismatch.push(q.external_id);
        continue;
      }
      let { subject, topic } = r;
      if (vestibular && !validTopic.has(`${subject}›${topic}`)) {
        badTopic.push(`${q.external_id} (${subject} › ${topic})`);
        topic = undefined as unknown as string;
        subject = q.subject ?? subject;
      }
      Object.assign(q, {
        explanation_md: r.explanation_md,
        subject: q.subject ?? subject,
        topic: topic ?? q.topic,
        area: vestibular ? (q.area ?? r.area ?? areaOf.get(subject)) : undefined,
      });
      solved.add(q.external_id);
    }
  }

  const v = validateBundle(raw);
  if (!v.bundle || v.issues.length) {
    console.error(`${name}: arquivo inválido — ${v.issues.slice(0, 5).map((x) => `${x.where}: ${x.message}`).join("; ")}`);
    process.exitCode = 1;
    continue;
  }
  // em partes: a mesma prova repetida em cada parte só é atualizada (chave: vestibular + ano + nome)
  let inserted = 0, updated = 0;
  for (const exam of v.bundle.exams) {
    for (let k = 0; k < exam.questions.length; k += 40) {
      const part = { version: 1, board: v.bundle.board, exams: [{ ...exam, questions: exam.questions.slice(k, k + 40) }], questions: [] };
      const { data, error } = await supabase.rpc("import_bundle", { p: part });
      if (error) {
        console.error(`${name} · ${exam.name}: ${error.message}`);
        process.exitCode = 1;
        break;
      }
      inserted += (data as { inserted: number }).inserted;
      updated += (data as { updated: number }).updated;
    }
  }
  const unique = new Set(v.bundle.exams.flatMap((e) => e.questions.map((q) => q.external_id))).size;
  total += unique;
  console.log(`${name}: ${v.bundle.exams.length} prova(s), ${unique} questões (${inserted} novas, ${updated} atualizadas) · ${solved.size} com resolução`);
  if (mismatch.length) console.log(`  resolução com gabarito diferente do caderno (ignorada): ${mismatch.join(", ")}`);
  if (badTopic.length) console.log(`  assunto fora da taxonomia (ficou sem assunto): ${badTopic.join(", ")}`);
}
console.log(`Total: ${total} questões.`);
