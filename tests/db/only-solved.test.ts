import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, callAs, connect, createUser, resetDb, seedBundle } from "./helpers";

let c: Client;
let admin: string, alice: string;

const alts = (n: number) => ["A", "B", "C", "D", "E"].slice(0, n).map((label) => ({ label, text_md: `alt ${label}` }));
const q = (number: number, correct: string, extra: Record<string, unknown> = {}) => ({
  number, area: "matematica", subject: "Matemática", statement_md: `Questão ${number}`, alternatives: alts(5), correct, ...extra,
});

beforeAll(async () => {
  c = await connect();
  await resetDb(c, { onlySolved: true });
  admin = await createUser(c, "admin@x.com", "admin");
  alice = await createUser(c, "alice@x.com");
  await seedBundle(c, {
    board: "ENEM",
    exams: [{
      name: "ENEM 2023 — Dia 2", year: 2023, format: "ENEM_dia2",
      questions: [q(1, "A", { explanation_md: "porque A" }), q(2, "B"), q(3, "C", { explanation_md: "porque C" }), q(4, "D")],
    }],
  });
});
afterAll(() => c.end());

const visible = (user: string) =>
  asUser(c, user, async () => (await c.query("select number from questions order by number")).rows.map((r) => r.number));
const start = (user: string, p: Record<string, unknown>) =>
  callAs<{ start_attempt: string }[]>(c, user, "select public.start_attempt($1::jsonb)", [JSON.stringify(p)]).then((r) => r[0].start_attempt);
const picked = async (attempt: string) =>
  (await c.query("select q.number from attempt_questions aq join questions q on q.id = aq.question_id where aq.attempt_id = $1 order by q.number", [attempt])).rows.map((r) => r.number);
const applyAs = async (user: string, p: unknown) => {
  await c.query("begin");
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
  const r = (await c.query("select public.apply_explanations($1::jsonb) as r", [JSON.stringify(p)])).rows[0].r;
  await c.query("commit");
  return r;
};

describe("só questões com resolução", () => {
  it("has_solution acompanha a resolução (trigger)", async () => {
    const { rows } = await c.query("select number, has_solution from questions order by number");
    expect(rows).toEqual([{ number: 1, has_solution: true }, { number: 2, has_solution: false }, { number: 3, has_solution: true }, { number: 4, has_solution: false }]);
  });

  it("aluno só vê as resolvidas; admin vê todas", async () => {
    expect(await visible(alice)).toEqual([1, 3]);
    expect(await visible(admin)).toEqual([1, 2, 3, 4]);
  });

  it("simulado e treino só sorteiam as resolvidas; vínculo prova↔questão também filtra", async () => {
    const exam = (await c.query("select id from exams limit 1")).rows[0].id;
    expect(await picked(await start(alice, { mode: "simulado", exam_id: exam }))).toEqual([1, 3]);
    expect(await picked(await start(alice, { mode: "treino", count: 10 }))).toEqual([1, 3]);
    const n = await asUser(c, alice, async () => (await c.query("select count(*)::int n from exam_questions")).rows[0].n);
    expect(n).toBe(2);
  });

  it("questão que perde a resolução some da lista, mas continua visível na tentativa antiga", async () => {
    await c.query("update answer_keys set explanation_md = null where question_id = (select id from questions where number = 3)");
    expect(await visible(alice)).toEqual([1, 3]); // 3 já está nas tentativas da Alice
    const fresh = await start(alice, { mode: "treino", count: 10 });
    expect(await picked(fresh)).toEqual([1]);
    await c.query("update answer_keys set explanation_md = 'porque C' where question_id = (select id from questions where number = 3)");
  });

  it("desligar a configuração mostra tudo de novo", async () => {
    await c.query("update settings set value = 'false' where key = 'only_solved_questions'");
    expect(await visible(alice)).toEqual([1, 2, 3, 4]);
    await c.query("update settings set value = 'true' where key = 'only_solved_questions'");
  });
});

describe("apply_explanations com correções do PDF oficial", () => {
  it("corrige enunciado/alternativas, troca gabarito errado da fonte e anula questões", async () => {
    const r = await applyAs(admin, { board: "ENEM", year: 2023, items: [
      { number: 2, correct: "E", override_correct: true, statement_md: "Questão 2 corrigida",
        alternatives: ["A", "B", "C", "D", "E"].map((label) => ({ label, text_md: `nova ${label}` })), explanation_md: "porque E" },
      { number: 4, correct: "D", annulled: true },
      { number: 1, correct: "B", explanation_md: "errada" },
    ] });
    expect(r).toEqual({ updated: 1, fixed: 1, annulled: 1, missing: [], mismatch: ["1 (banco A, arquivo B)"] });
    const q2 = (await c.query("select q.statement_md, q.has_solution, k.correct_label, (select text_md from alternatives where question_id = q.id and label = 'E') e from questions q join answer_keys k on k.question_id = q.id where number = 2")).rows[0];
    expect(q2).toEqual({ statement_md: "Questão 2 corrigida", has_solution: true, correct_label: "E", e: "nova E" });
    const q4 = (await c.query("select is_active from questions where number = 4")).rows[0];
    expect(q4.is_active).toBe(false);
    expect(await visible(alice)).toEqual([1, 2, 3]);
  });

  it("aluno não aplica correções", async () => {
    await c.query("rollback").catch(() => {});
    await expect(applyAs(alice, { board: "ENEM", year: 2023, items: [] })).rejects.toThrow(/permission denied/);
    await c.query("rollback");
  });
});
