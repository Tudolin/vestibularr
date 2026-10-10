import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { callAs, connect, createUser, resetDb, seedBundle } from "./helpers";

let c: Client;
let admin: string, alice: string, bob: string;
const alts = ["A", "B", "C", "D", "E"].map((label) => ({ label, text_md: label }));

beforeAll(async () => {
  c = await connect();
  await resetDb(c);
  admin = await createUser(c, "admin@x.com", "admin");
  alice = await createUser(c, "alice@x.com");
  bob = await createUser(c, "bob@x.com");
  await seedBundle(c, {
    board: "ENEM",
    exams: [{
      name: "ENEM 2023 — Dia 2", year: 2023, format: "ENEM_dia2",
      questions: [136, 137, 138].map((number) => ({ number, area: "matematica", statement_md: `Q${number}`, alternatives: alts, correct: "A" })),
    }],
  });
});
afterAll(() => c.end());

const one = async (user: string, sql: string, params: unknown[] = []) => ((await callAs<any[]>(c, user, sql, params))[0] as any).r;
const payload = {
  board: "ENEM", year: 2023, items: [
    { number: 136, subject: "Matemática", topic: "Estatística", skill: 27, irt: { a: 2.1, b: 0.8, c: 0.17 }, item: 123 },
    { number: 137, skill: 3, irt: { a: 1.5, b: 1.9, c: 0.2 } },
    { number: 999, subject: "Matemática", topic: "Funções" },
  ],
};

describe("apply_taxonomy", () => {
  it("só admin (ou service-role) aplica", async () => {
    await expect(callAs(c, alice, "select public.apply_taxonomy($1::jsonb)", [JSON.stringify(payload)])).rejects.toThrow(/permission denied/);
  });

  it("grava assunto, habilidade e TRI; campos ausentes não apagam; lista as não encontradas", async () => {
    await c.query("update questions set subject = 'Matemática', topic = 'Funções' where number = 137");
    const r = await one(admin, "select public.apply_taxonomy($1::jsonb) r", [JSON.stringify(payload)]);
    expect(r).toEqual({ updated: 2, missing: ["999"] });
    const { rows } = await c.query("select number, subject, topic, skill, irt_a, irt_b, irt_c, inep_item from questions order by number");
    expect(rows[0]).toMatchObject({ number: 136, subject: "Matemática", topic: "Estatística", skill: 27, inep_item: 123 });
    expect(rows[0].irt_b).toBeCloseTo(0.8, 5);
    expect(rows[1]).toMatchObject({ number: 137, topic: "Funções", skill: 3 }); // assunto preservado
    expect(rows[2]).toMatchObject({ number: 138, skill: null, irt_a: null });
  });
});

describe("answer_facts", () => {
  it("devolve as respostas corrigidas com TRI; a resposta mais recente vale; só o dono (ou admin) lê", async () => {
    const id = await one(alice, "select public.start_attempt($1::jsonb) r", [JSON.stringify({ mode: "treino", count: 3 })]);
    const qs = (await c.query("select aq.question_id, q.number from attempt_questions aq join questions q on q.id = aq.question_id where attempt_id=$1", [id])).rows;
    const ops = qs.map((r, i) => ({ op_id: randomUUID(), question_id: r.question_id, field: "choice", value: r.number === 136 ? "A" : "C", ts: Date.now() + i }));
    await one(alice, "select public.sync_attempt($1, $2::jsonb) r", [id, JSON.stringify(ops)]);

    const facts = await callAs<any[]>(c, alice, "select * from public.answer_facts(null, 'ENEM')");
    expect(facts).toHaveLength(3);
    const f136 = facts.find((f) => f.topic === "Estatística");
    expect(f136).toMatchObject({ board: "ENEM", area: "matematica", subject: "Matemática", ok: true, skill: 27 });
    expect(facts.filter((f) => !f.ok)).toHaveLength(2);

    // refez a 136 errando: vale a mais recente
    const id2 = await one(alice, "select public.start_attempt($1::jsonb) r", [JSON.stringify({ mode: "treino", topics: ["Estatística"], count: 1 })]);
    const q = (await c.query("select question_id from attempt_questions where attempt_id=$1", [id2])).rows[0].question_id;
    await one(alice, "select public.sync_attempt($1, $2::jsonb) r", [id2, JSON.stringify([{ op_id: randomUUID(), question_id: q, field: "choice", value: "B", ts: Date.now() + 99 }])]);
    await c.query("update attempt_answers set answered_at = now() + interval '1 minute' where attempt_id = $1", [id2]);
    const again = await callAs<any[]>(c, alice, "select * from public.answer_facts()");
    expect(again).toHaveLength(3);
    expect(again.find((f) => f.topic === "Estatística").ok).toBe(false);

    await expect(callAs(c, bob, "select * from public.answer_facts($1)", [alice])).rejects.toThrow(/permission denied/);
    expect(await callAs<any[]>(c, admin, "select * from public.answer_facts($1)", [alice])).toHaveLength(3);
    expect(await callAs<any[]>(c, bob, "select * from public.answer_facts()")).toHaveLength(0);
  });
});
