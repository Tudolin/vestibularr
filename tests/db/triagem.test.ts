import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, callAs, connect, createUser, resetDb, seedBundle } from "./helpers";

let c: Client;
let ana: string, bia: string, caio: string;
const alts = ["A", "B", "C", "D", "E"].map((label) => ({ label, text_md: label }));
const AREAS = ["linguagens", "humanas", "natureza", "matematica"];

beforeAll(async () => {
  c = await connect();
  await resetDb(c);
  ana = await createUser(c, "ana@x.com");
  bia = await createUser(c, "bia@x.com");
  caio = await createUser(c, "caio@x.com");
  // 40 questões por área, dificuldade de −4 a 3,8 (gabarito sempre A): sobra item perto de qualquer θ
  await seedBundle(c, {
    board: "ENEM",
    questions: AREAS.flatMap((area, ai) => Array.from({ length: 40 }, (_, i) => ({
      external_id: `${area}-${i}`, area, subject: "X", topic: `T${i % 3}`, statement_md: `${area} ${i}`, alternatives: alts, correct: "A",
    }))),
  });
  await c.query(`update questions set irt_a = 2, irt_c = 0.2, irt_b = -4 + 0.2 * split_part(external_id, '-', 2)::int`);
  // Caio no plano grátis (1 triagem por mês); os outros estão no teste grátis do Pro
  await c.query("update subscriptions set plan_code = 'free', status = 'active', trial_end = null where user_id = $1", [caio]);
});
afterAll(() => c.end());

const one = async (user: string, sql: string, params: unknown[] = []) => ((await callAs<any[]>(c, user, sql, params))[0] as any).r;
const state = (u: string, id: string) => one(u, "select public.triagem_state($1) r", [id]);
const bOf = async (qid: string) => Number((await c.query("select irt_b from questions where id = $1", [qid])).rows[0].irt_b);
const areaOf = async (qid: string) => (await c.query("select area from questions where id = $1", [qid])).rows[0].area as string;

/** Responde até acabar: `right(area)` decide se acerta. Devolve as dificuldades por área, na ordem. */
async function run(user: string, id: string, right: (area: string) => boolean | null) {
  const path: Record<string, number[]> = {};
  for (let s = await state(user, id); s.status === "in_progress"; ) {
    const area = await areaOf(s.question_id);
    (path[area] ??= []).push(await bOf(s.question_id));
    const r = right(area);
    s = await one(user, "select public.triagem_answer($1, $2, $3) r", [id, s.question_id, r === null ? null : r ? "A" : "B"]);
  }
  return path;
}

describe("triagem adaptativa", () => {
  it("começa, retoma a mesma e só mostra a questão atual (sem gabarito)", async () => {
    const id = await one(ana, "select public.triagem_start() r");
    expect(await one(ana, "select public.triagem_start() r")).toBe(id);
    const s = await state(ana, id);
    expect(s).toMatchObject({ status: "in_progress", answered: 0, total: 32, position: 0, area: "linguagens" });
    const key = await asUser(c, ana, async () => (await c.query("select * from answer_keys where question_id = $1", [s.question_id])).rows);
    expect(key).toHaveLength(0);
  });

  it("não aceita responder outra questão nem mexer pelo sync_attempt", async () => {
    const id = await one(ana, "select public.triagem_start() r");
    const other = (await c.query("select id from questions where external_id = 'matematica-29'")).rows[0].id;
    await expect(callAs(c, ana, "select public.triagem_answer($1, $2, 'A')", [id, other])).rejects.toThrow(/not_current/);
    const s = await state(ana, id);
    const ops = [{ op_id: randomUUID(), question_id: s.question_id, field: "choice", value: "A", ts: Date.now() }];
    await expect(callAs(c, ana, "select public.sync_attempt($1, $2::jsonb)", [id, JSON.stringify(ops)])).rejects.toThrow(/triagem_readonly/);
  });

  it("acertando, as questões ficam mais difíceis; errando, mais fáceis; termina com 8 por área", async () => {
    const id = await one(ana, "select public.triagem_start() r");
    const up = await run(ana, id, () => true);
    const id2 = await one(bia, "select public.triagem_start() r");
    const down = await run(bia, id2, () => false);
    for (const area of AREAS) {
      expect(up[area]).toHaveLength(8);
      expect(up[area].at(-1)!).toBeGreaterThan(up[area][0]);
      expect(down[area].at(-1)!).toBeLessThan(down[area][0]);
    }
    const s = await state(ana, id);
    expect(s).toMatchObject({ status: "finished", answered: 32 });
    // acabou: gabarito liberado, entra no domínio por assunto e no placar da tentativa
    const keys = await asUser(c, ana, async () => (await c.query("select count(*)::int n from answer_keys")).rows[0].n);
    expect(keys).toBe(32);
    const facts = await callAs<any[]>(c, ana, "select * from public.answer_facts()");
    expect(facts).toHaveLength(32);
    const score = (await c.query("select score from exam_attempts where id = $1", [id])).rows[0].score;
    expect(score).toMatchObject({ total: 32, correct: 32 });
    await expect(callAs(c, ana, "select public.triagem_answer($1, $2, 'A')", [id, s.question_id ?? randomUUID()])).rejects.toThrow(/triagem_finished/);
  });

  it("'não sei' conta como erro; dá para encerrar antes e a questão pendente sai", async () => {
    const id = await one(ana, "select public.triagem_start() r"); // Pro em teste: pode repetir
    let s = await state(ana, id);
    s = await one(ana, "select public.triagem_answer($1, $2, null) r", [id, s.question_id]);
    s = await one(ana, "select public.triagem_answer($1, $2, 'A') r", [id, s.question_id]);
    const end = await one(ana, "select public.triagem_finish($1) r", [id]);
    expect(end).toMatchObject({ status: "finished", answered: 2 });
    const score = (await c.query("select score from exam_attempts where id = $1", [id])).rows[0].score;
    expect(score).toMatchObject({ total: 2, correct: 1, blank: 1 });
  });

  it("plano grátis: 1 triagem por mês", async () => {
    const id = await one(caio, "select public.triagem_start() r");
    await one(caio, "select public.triagem_finish($1) r", [id]);
    await expect(callAs(c, caio, "select public.triagem_start()")).rejects.toThrow(/plan_limit:triagem/);
    const rep = await one(caio, "select public.entitlement('triagem_report') r");
    expect(rep.quota).toBe(0);
  });

  it("só o dono vê o estado", async () => {
    const id = await one(ana, "select public.triagem_start() r");
    await expect(callAs(c, bia, "select public.triagem_state($1)", [id])).rejects.toThrow(/not_found/);
  });
});
