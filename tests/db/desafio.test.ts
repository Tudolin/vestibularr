import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, callAs, connect, createUser, resetDb, seedBundle } from "./helpers";

let c: Client;
let ana: string, bia: string;
const alts = ["A", "B", "C", "D", "E"].map((label) => ({ label, text_md: label }));

beforeAll(async () => {
  c = await connect();
  await resetDb(c);
  ana = await createUser(c, "ana@x.com");
  bia = await createUser(c, "bia@x.com");
  // 60 questões em 4 assuntos, dificuldade crescente, gabarito A
  await seedBundle(c, {
    board: "ENEM",
    questions: Array.from({ length: 60 }, (_, i) => ({
      external_id: `q-${i}`, area: "matematica", subject: "Matemática", topic: `T${i % 4}`, statement_md: `q ${i}`, alternatives: alts, correct: "A",
    })),
  });
  await c.query(`update questions set irt_b = -2 + 0.08 * split_part(external_id, '-', 2)::int`);
});
afterAll(() => c.end());

const r = async (user: string, sql: string, params: unknown[] = []) => ((await callAs<any[]>(c, user, sql, params))[0] as any).r;
const startDaily = (u: string) => r(u, "select public.daily_challenge_start() r");
const status = (u: string) => asUser(c, u, async () => (await c.query("select public.daily_status() r")).rows[0].r);
const answer = (u: string, attempt: string, qid: string, choice: string) =>
  callAs(c, u, "select public.sync_attempt($1, $2::jsonb, 'teste')", [attempt, JSON.stringify([{ op_id: randomUUID(), question_id: qid, field: "choice", value: choice, ts: Date.now() }])]);
const questionsOf = async (attempt: string) =>
  (await c.query("select aq.question_id, aq.section, q.topic, q.irt_b from attempt_questions aq join questions q on q.id = aq.question_id where attempt_id = $1 order by position", [attempt])).rows;
const xpToday = async (u: string) => Number((await c.query("select coalesce(sum(xp),0) s from xp_events where user_id = $1 and day = public._sp_day()", [u])).rows[0].s);

describe("desafio do dia", () => {
  it("7 questões, o mesmo desafio o dia todo, chefão é a mais difícil", async () => {
    const id = await startDaily(ana);
    expect(await startDaily(ana)).toBe(id);
    const qs = await questionsOf(id);
    expect(qs).toHaveLength(7);
    expect(new Set(qs.map((q) => q.question_id)).size).toBe(7);
    const boss = qs.find((q) => q.section === "chefao")!;
    expect(Number(boss.irt_b)).toBeGreaterThan(Math.max(...qs.filter((q) => q !== boss).map((q) => Number(q.irt_b))));
    expect(await status(ana)).toMatchObject({ attempt_id: id, total: 7, answered: 0, completed: false });
  });

  it("chefão vale XP em dobro; completar dá +30 e vai para o mural", async () => {
    const id = await startDaily(ana);
    const qs = await questionsOf(id);
    const boss = qs.find((q) => q.section === "chefao")!;
    await answer(ana, id, boss.question_id, "A");
    expect(await xpToday(ana)).toBe(40); // irt_b alto: 20 × 2
    for (const q of qs.filter((x) => x !== boss)) await answer(ana, id, q.question_id, "B");
    const s = await status(ana);
    expect(s).toMatchObject({ completed: true, correct: 1, answered: 7, streak: 1 });
    expect(await xpToday(ana)).toBe(40 + 6 * 2 + 30);
    expect((await c.query("select payload from activity_events where user_id = $1 and kind = 'desafio'", [ana])).rows[0].payload).toMatchObject({ correct: 1, total: 7 });
  });

  it("puxa os erros do caderno para revisão e foca no assunto mais fraco", async () => {
    // Bia: errou tudo de T1 e acertou tudo de T2 em treinos antigos
    const t1 = (await c.query("select id from questions where topic = 'T1' order by irt_b limit 4")).rows.map((x) => x.id);
    const t2 = (await c.query("select id from questions where topic = 'T2' order by irt_b limit 4")).rows.map((x) => x.id);
    const old = (await c.query("insert into exam_attempts (user_id, mode, title, config) values ($1, 'treino', 'velho', '{}') returning id", [bia])).rows[0].id;
    for (const [i, q] of [...t1, ...t2].entries()) {
      await c.query("insert into attempt_questions (attempt_id, position, question_id) values ($1, $2, $3)", [old, i, q]);
      await c.query("insert into attempt_answers (attempt_id, question_id, choice, answered_at) values ($1, $2, $3, now() - interval '40 days')", [old, q, t1.includes(q) ? "B" : "A"]);
    }
    await c.query("insert into error_notebook (user_id, question_id) select $1, unnest($2::uuid[])", [bia, t1.slice(0, 2)]);
    const qs = await questionsOf(await startDaily(bia));
    expect(qs.filter((q) => q.topic === "T1").length).toBeGreaterThanOrEqual(3);
    expect(qs.map((q) => q.question_id)).toEqual(expect.arrayContaining(t1.slice(0, 2)));
    expect((await status(bia)).focus).toBe("T1");
  });
});

describe("sequência e escudos", () => {
  const day = async (u: string, ago: number) =>
    c.query("insert into xp_events (user_id, source, xp, ref, day) values ($1, 'bonus', 5, $2, public._sp_day() - $3::int)", [u, `t:${ago}:${randomUUID()}`, ago]);
  const streak = async (u: string) => Number((await c.query("select public._xp_streak($1) s", [u])).rows[0].s);
  const shields = async (u: string) => Number((await c.query("select public._shields($1) s", [u])).rows[0].s);

  it("a cada 7 dias seguidos ganha 1 escudo (no máximo 2)", async () => {
    const u = await createUser(c, "s1@x.com");
    for (let i = 13; i >= 1; i--) await day(u, i);
    await c.query("select public._award_xp($1, 'bonus', 5, 'hoje')", [u]); // 14º dia
    expect(await streak(u)).toBe(14);
    expect(await shields(u)).toBe(1);
    await c.query("update streak_shields set available = 2 where user_id = $1", [u]);
    await c.query("delete from xp_events where user_id = $1 and ref = 'hoje'", [u]);
    await c.query("update streak_shields set last_earned_day = null where user_id = $1", [u]);
    await c.query("select public._award_xp($1, 'bonus', 5, 'hoje2')", [u]);
    expect(await shields(u)).toBe(2); // não passa de 2
  });

  it("escudo cobre o dia perdido e é gasto quando o aluno volta", async () => {
    const u = await createUser(c, "s2@x.com");
    for (let i = 6; i >= 2; i--) await day(u, i); // 5 dias, perdeu ontem
    await c.query("insert into streak_shields (user_id, available) values ($1, 1)", [u]);
    expect(await streak(u)).toBe(5); // ainda viva: o escudo cobre ontem
    await c.query("select public._award_xp($1, 'bonus', 5, 'volta')", [u]);
    expect(await streak(u)).toBe(6);
    expect(await shields(u)).toBe(0);
    expect((await c.query("select count(*)::int n from streak_shield_days where user_id = $1", [u])).rows[0].n).toBe(1);
    expect((await c.query("select kind from activity_events where user_id = $1 and kind = 'escudo'", [u])).rows).toHaveLength(1);
  });

  it("sem escudos suficientes a sequência quebra e os escudos ficam guardados", async () => {
    const u = await createUser(c, "s3@x.com");
    for (let i = 8; i >= 4; i--) await day(u, i); // perdeu 3 dias
    await c.query("insert into streak_shields (user_id, available) values ($1, 2)", [u]);
    expect(await streak(u)).toBe(0);
    await c.query("select public._award_xp($1, 'bonus', 5, 'volta')", [u]);
    expect(await streak(u)).toBe(1);
    expect(await shields(u)).toBe(2);
  });
});
