import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, callAs, connect, createUser, resetDb, seedBundle } from "./helpers";

let c: Client;
let admin: string, alice: string, bob: string;
const alts = ["A", "B", "C", "D", "E"].map((label) => ({ label, text_md: label }));

beforeAll(async () => {
  c = await connect();
  await resetDb(c);
  admin = await createUser(c, "admin@x.com", "admin");
  alice = await createUser(c, "alice@x.com");
  bob = await createUser(c, "bob@x.com");
  await seedBundle(c, { board: "ENEM", questions: Array.from({ length: 30 }, (_, i) => ({
    external_id: `p${i}`, area: i < 15 ? "matematica" : "humanas", subject: i < 15 ? "Matemática" : "História",
    topic: i < 10 ? "Funções" : i < 15 ? "Geometria" : "Brasil Colônia", statement_md: `Q${i}`, alternatives: alts, correct: "A" })) });
});
afterAll(() => c.end());

const one = async (user: string, sql: string, params: unknown[] = []) => ((await callAs<any[]>(c, user, sql, params))[0] as any).r;
const stats = (user: string, board: string | null = null, target: string | null = null) => one(user, "select public.student_stats($1, $2) r", [target, board]);

/** Treino com N respostas (as primeiras `right` certas), todas no dia `daysAgo` (fuso de São Paulo). */
async function practice(user: string, topic: string, n: number, right: number, daysAgo = 0) {
  const id = await one(user, "select public.start_attempt($1::jsonb) r", [JSON.stringify({ mode: "treino", topics: [topic], count: n })]);
  const qs = (await c.query("select question_id from attempt_questions where attempt_id=$1 order by position", [id])).rows;
  const ops = qs.map((r, i) => ({ op_id: randomUUID(), question_id: r.question_id, field: "choice", value: i < right ? "A" : "B", ts: Date.now() + i }));
  await one(user, "select public.sync_attempt($1, $2::jsonb) r", [id, JSON.stringify(ops)]);
  await c.query("update attempt_answers set answered_at = now() - make_interval(days => $2), updated_at = now() - make_interval(days => $2) where attempt_id = $1", [id, daysAgo]);
  return id;
}

describe("student_stats", () => {
  it("conta respostas corrigíveis por área, disciplina e assunto", async () => {
    await practice(alice, "Funções", 10, 8);
    await practice(alice, "Brasil Colônia", 5, 1);
    const s = await stats(alice);
    expect(s.totals).toMatchObject({ answered: 15, correct: 9 });
    expect(s.by_topic.find((t: any) => t.key === "Funções")).toMatchObject({ answered: 10, correct: 8 });
    expect(s.by_area.map((a: any) => a.key).sort()).toEqual(["humanas", "matematica"]);
    expect(s.daily).toHaveLength(60);
    expect(s.week.answered_today).toBe(15);
  });

  it("respostas de simulado EM ANDAMENTO não contam (ainda sem gabarito)", async () => {
    const id = await one(alice, "select public.start_attempt($1::jsonb) r", [JSON.stringify({ mode: "custom", topics: ["Geometria"], count: 3, minutes: 30 })]);
    const qid = (await c.query("select question_id from attempt_questions where attempt_id=$1 limit 1", [id])).rows[0].question_id;
    await one(alice, "select public.sync_attempt($1, $2::jsonb) r", [id, JSON.stringify([{ op_id: randomUUID(), question_id: qid, field: "choice", value: "A", ts: Date.now() }])]);
    expect((await stats(alice)).totals.answered).toBe(15);
    await one(alice, "select public.finish_attempt($1) r", [id]);
    expect((await stats(alice)).totals.answered).toBe(16);
  });

  it("filtro por vestibular", async () => {
    expect((await stats(alice, "UFPR")).totals.answered).toBe(0);
    expect((await stats(alice, "ENEM")).totals.answered).toBe(16);
  });

  it("sequência: dias consecutivos até hoje (ou ontem) e melhor sequência", async () => {
    for (const d of [1, 2, 3, 5, 6]) await practice(bob, "Geometria", 1, 1, d);
    let s = await stats(bob);
    expect(s.streak).toMatchObject({ current: 3, best: 3, studied_today: false }); // ontem, anteontem, 3 dias (ainda vale)
    await practice(bob, "Geometria", 1, 1, 0);
    s = await stats(bob);
    expect(s.streak).toMatchObject({ current: 4, best: 4, studied_today: true });
  });

  it("aluno não vê estatística de outro; admin vê", async () => {
    await expect(stats(bob, null, alice)).rejects.toThrow(/permission denied/);
    expect((await stats(admin, null, alice)).totals.answered).toBe(16);
  });
});

describe("tempo de estudo e logs", () => {
  it("ping soma no máximo 90 s por intervalo e registra página com limite de 10 min", async () => {
    await one(alice, "select public.ping_activity('/inicio', 'mobile') r");
    await c.query("update study_sessions set last_ping = now() - interval '60 seconds' where user_id=$1", [alice]);
    await one(alice, "select public.ping_activity(null, 'mobile') r");
    await c.query("update study_sessions set last_ping = now() - interval '150 seconds' where user_id=$1", [alice]);
    await one(alice, "select public.ping_activity(null, 'mobile') r"); // limitado a 90
    await c.query("update study_sessions set last_ping = now() - interval '30 minutes' where user_id=$1", [alice]);
    await one(alice, "select public.ping_activity('/inicio', 'mobile') r"); // voltou depois de muito tempo: não conta o intervalo
    const sec = (await c.query("select seconds from study_sessions where user_id=$1", [alice])).rows[0].seconds;
    expect(sec).toBeGreaterThanOrEqual(150);
    expect(sec).toBeLessThanOrEqual(152);
    expect((await c.query("select count(*)::int n from access_logs where user_id=$1 and path='/inicio'", [alice])).rows[0].n).toBe(1);
    expect((await stats(alice)).week.minutes).toBe(2);
  });
  it("aluno não lê sessões de outro", async () => {
    const rows = await asUser(c, bob, async () => (await c.query("select user_id from study_sessions")).rows);
    expect(rows.every((r) => r.user_id === bob)).toBe(true);
  });
});

describe("metas", () => {
  it("aluno define as próprias metas e não as de outro", async () => {
    await asUser(c, alice, async () => {
      await c.query("insert into student_goals (user_id, kind, target) values ($1, 'questions_week', 50)", [alice]);
      await expect(c.query("insert into student_goals (user_id, kind, target) values ($1, 'questions_week', 50)", [bob])).rejects.toThrow(/row-level/);
    });
    await callAs(c, alice, "insert into student_goals (user_id, kind, target) values ($1, 'questions_week', 50)", [alice]);
    expect((await stats(alice)).goals).toEqual({ questions_week: 50 });
  });
});

describe("conquistas", () => {
  it("calculadas no servidor, idempotentes e sem autoatribuição", async () => {
    const first = await one(alice, "select public.refresh_achievements() r");
    expect(first).toEqual(expect.arrayContaining(["primeiro_passo", "primeiro_simulado"]));
    expect(await one(alice, "select public.refresh_achievements() r")).toEqual([]);
    await expect(asUser(c, alice, () => c.query("insert into achievements (user_id, code) values ($1, 'mil_questoes')", [alice]))).rejects.toThrow(/row-level|permission/);
    await expect(one(alice, "select public.refresh_achievements($1) r", [bob])).rejects.toThrow(/permission denied/);
  });
});

describe("admin_overview e cursos", () => {
  it("só admin; traz cada aluno com estatísticas e assuntos fracos", async () => {
    await expect(one(alice, "select public.admin_overview() r")).rejects.toThrow(/permission denied/);
    const o = await one(admin, "select public.admin_overview('ENEM') r");
    const a = o.find((x: any) => x.id === alice);
    expect(a.stats.totals.answered).toBe(16);
    expect(a.weak_topics[0].key).toBe("Brasil Colônia");
  });
  it("62 cursos UFPR do Anexo XX com pesos coerentes; aluno escolhe alvos mas não edita cursos", async () => {
    expect((await c.query("select count(*)::int n from courses where via='ufpr'")).rows[0].n).toBe(62);
    const cc = (await c.query("select ufpr_specific from courses where name='Ciência da Computação' and campus='Curitiba'")).rows[0];
    expect(cc.ufpr_specific).toEqual([{ subject: "Matemática", weight: 2.5 }]);
    const any = (await c.query("select id from courses limit 1")).rows[0].id;
    expect((await asUser(c, alice, () => c.query("update profiles set target_courses = array[$1]::uuid[] where id=$2", [any, alice]))).rowCount).toBe(1);
    expect((await asUser(c, alice, () => c.query("update courses set name='x'"))).rowCount).toBe(0);
  });
});
