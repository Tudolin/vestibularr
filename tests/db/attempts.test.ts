import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, callAs, connect, createUser, resetDb, seedBundle } from "./helpers";

let c: Client;
let alice: string, bob: string;
let examId: string;

const alts = (n: number) => ["A", "B", "C", "D", "E"].slice(0, n).map((label) => ({ label, text_md: `alt ${label}` }));
const q = (number: number, correct: string, extra: Record<string, unknown> = {}) => ({
  number, area: "matematica", subject: "Matemática", statement_md: `Questão ${number}`, alternatives: alts(5), correct, ...extra,
});

beforeAll(async () => {
  c = await connect();
  await resetDb(c);
  await createUser(c, "admin@x.com", "admin");
  alice = await createUser(c, "alice@x.com");
  bob = await createUser(c, "bob@x.com");
  await seedBundle(c, {
    board: "ENEM",
    exams: [{
      name: "ENEM 2023 — Dia 2", year: 2023, format: "ENEM_dia2",
      questions: [q(1, "A"), q(2, "B"), q(3, "C"), q(1, "D", { language: "ingles", area: "linguagens" }), q(1, "E", { language: "espanhol", area: "linguagens" })],
    }],
    questions: [
      { external_id: "d:1", kind: "discursive", subject: "Redação", statement_md: "Discursiva", official_mirror_md: "espelho", max_score: 10 },
      ...Array.from({ length: 6 }, (_, i) => q(100 + i, "A", { number: undefined, external_id: `avulsa:${i}`, topic: i < 3 ? "Funções" : "Geometria" })),
    ],
  });
  examId = (await c.query("select id from exams limit 1")).rows[0].id;
});
afterAll(() => c.end());

const start = (user: string, p: Record<string, unknown>) =>
  callAs<{ start_attempt: string }[]>(c, user, "select public.start_attempt($1::jsonb)", [JSON.stringify(p)]).then((r) => r[0].start_attempt);
const sync = (user: string, attempt: string, ops: unknown[]) =>
  callAs<{ r: any }[]>(c, user, "select public.sync_attempt($1, $2::jsonb, 'teste') r", [attempt, JSON.stringify(ops)]).then((r) => r[0].r);
const state = (user: string, attempt: string) =>
  callAs<{ r: any }[]>(c, user, "select public.attempt_state($1) r", [attempt]).then((r) => r[0].r);
const qid = async (number: number, language: string | null = null) =>
  (await c.query("select id from questions where number = $1 and coalesce(language,'') = $2", [number, language ?? ""])).rows[0].id as string;
const op = (question_id: string | null, field: string, value: unknown, ts: number, op_id = randomUUID()) => ({ op_id, question_id, field, value, ts });
const now = () => Date.now();

describe("start_attempt", () => {
  it("simulado ENEM exige idioma e usa a duração do formato", async () => {
    await expect(start(alice, { mode: "simulado", exam_id: examId })).rejects.toThrow(/language_required/);
    const id = await start(alice, { mode: "simulado", exam_id: examId, language: "ingles" });
    const { rows } = await c.query(
      "select count(*)::int n, (select extract(epoch from deadline_at - started_at)/60 from exam_attempts where id=$1)::int mins from attempt_questions where attempt_id=$1", [id]);
    expect(rows[0]).toEqual({ n: 4, mins: 300 }); // 3 comuns + 1 de inglês; ENEM dia 2 = 5h
    const langs = (await c.query("select q.language from attempt_questions aq join questions q on q.id=aq.question_id where aq.attempt_id=$1", [id])).rows.map((r) => r.language);
    expect(langs).not.toContain("espanhol");
  });

  it("personalizado respeita filtros, quantidade e tempo; treino não tem prazo", async () => {
    const id = await start(alice, { mode: "custom", board: "ENEM", topics: ["Funções"], count: 2, minutes: 30 });
    const { rows } = await c.query("select count(*)::int n, bool_and(q.topic = 'Funções') ok from attempt_questions aq join questions q on q.id=aq.question_id where attempt_id=$1", [id]);
    expect(rows[0]).toEqual({ n: 2, ok: true });
    const t = await start(alice, { mode: "treino", board: "ENEM", count: 3, minutes: 99 });
    expect((await c.query("select deadline_at from exam_attempts where id=$1", [t])).rows[0].deadline_at).toBeNull();
  });

  it("quotas por disciplina e discursivas", async () => {
    const id = await start(alice, { mode: "custom", quotas: { Matemática: 2 }, discursive: 1 });
    const { rows } = await c.query("select q.kind, count(*)::int n from attempt_questions aq join questions q on q.id=aq.question_id where attempt_id=$1 group by 1 order by 1", [id]);
    expect(rows).toEqual([{ kind: "discursive", n: 1 }, { kind: "objective", n: 2 }]);
  });

  it("sem questões e filtros inválidos falham com mensagem clara", async () => {
    await expect(start(alice, { mode: "custom", topics: ["Inexistente"] })).rejects.toThrow(/no_questions/);
    await expect(start(alice, { mode: "revisao" })).rejects.toThrow(/no_errors_due/);
    await expect(start(alice, { mode: "xyz" })).rejects.toThrow(/modo inválido/);
    await expect(start(alice, { mode: "custom", minutes: 9999 })).rejects.toThrow(/tempo inválido/);
  });

  it("aluno não grava direto nas tabelas de tentativa", async () => {
    await expect(asUser(c, alice, () => c.query("insert into exam_attempts (user_id, mode, title) values ($1,'treino','x')", [alice]))).rejects.toThrow(/row-level security|permission denied/);
    const upd = await asUser(c, alice, () => c.query("update exam_attempts set status='finished'"));
    expect(upd.rowCount).toBe(0);
  });
});

describe("sync_attempt", () => {
  let att: string, q1: string, q2: string;
  beforeAll(async () => {
    att = await start(alice, { mode: "simulado", exam_id: examId, language: "ingles" });
    q1 = await qid(1);
    q2 = await qid(2);
  });

  it("aplica operações e devolve estado", async () => {
    const t = now();
    const r = await sync(alice, att, [op(q1, "choice", "A", t), op(q1, "flagged", true, t), op(q2, "strikes", ["C", "D"], t), op(null, "current_index", 1, t)]);
    expect(r.applied).toHaveLength(4);
    expect(r.rejected).toEqual([]);
    const s = await state(alice, att);
    const a1 = s.answers.find((a: any) => a.question_id === q1);
    expect(a1).toMatchObject({ choice: "A", flagged: true });
    expect(s.attempt.current_index).toBe(1);
    expect(typeof s.server_now).toBe("number");
  });

  it("é idempotente: reenviar o mesmo op_id não reaplica", async () => {
    const o = op(q2, "choice", "B", now());
    await sync(alice, att, [o]);
    await sync(alice, att, [op(q2, "choice", "C", now() + 10)]);
    const again = await sync(alice, att, [o]); // reenvio da op antiga
    expect(again.applied).toContain(o.op_id);
    expect((await state(alice, att)).answers.find((a: any) => a.question_id === q2).choice).toBe("C");
  });

  it("última escrita por campo: ts antigo não sobrescreve ts novo, mesmo chegando depois", async () => {
    const t = now() + 1000;
    await sync(alice, att, [op(q1, "choice", "E", t + 500)]);
    await sync(alice, att, [op(q1, "choice", "B", t)]); // chegou depois, mas é mais antiga
    expect((await state(alice, att)).answers.find((a: any) => a.question_id === q1).choice).toBe("E");
    // campos diferentes não conflitam
    await sync(alice, att, [op(q1, "flagged", false, t - 1000)]);
    const a1 = (await state(alice, att)).answers.find((a: any) => a.question_id === q1);
    expect(a1).toMatchObject({ choice: "E" });
  });

  it("permite desmarcar (choice null) e tempo só cresce", async () => {
    const t = now() + 5000;
    await sync(alice, att, [op(q2, "choice", null, t)]);
    await sync(alice, att, [op(q2, "time_spent_ms", 9000, t), op(q2, "time_spent_ms", 4000, t + 1)]);
    const a = (await state(alice, att)).answers.find((a: any) => a.question_id === q2);
    expect(a.choice).toBeNull();
    expect(Number(a.time_spent_ms)).toBe(9000);
  });

  it("rejeita valores inválidos, questão fora da tentativa e dono errado", async () => {
    const outsider = await qid(100 - 100 + 1, "espanhol"); // espanhol não está nesta tentativa
    const r = await sync(alice, att, [op(q1, "choice", "Z", now()), op(outsider, "choice", "A", now()), op(q1, "campo_estranho", 1, now())]);
    expect(r.rejected.map((x: any) => x.reason).sort()).toEqual(["invalid", "invalid", "unknown_question"]);
    await expect(sync(bob, att, [])).rejects.toThrow(/not_found/);
  });

  it("limites de tamanho: discursiva > 20k chars é rejeitada", async () => {
    const r = await sync(alice, att, [op(q1, "discursive_text", "x".repeat(20001), now())]);
    expect(r.rejected[0].reason).toBe("invalid");
  });

  it("operação com timestamp depois do prazo é rejeitada ('late')", async () => {
    const id = await start(alice, { mode: "custom", board: "ENEM", count: 2, minutes: 10 });
    const first = (await c.query("select question_id from attempt_questions where attempt_id=$1 limit 1", [id])).rows[0].question_id;
    const { deadline_at } = (await c.query("select deadline_at from exam_attempts where id=$1", [id])).rows[0];
    const r = await sync(alice, id, [op(first, "choice", "A", deadline_at.getTime() + 60_000), op(first, "choice", "B", deadline_at.getTime() - 1000)]);
    expect(r.rejected.map((x: any) => x.reason)).toEqual(["late"]);
    expect(r.applied).toHaveLength(1);
  });
});

describe("expiração, finalização e gabarito", () => {
  it("expira no servidor: não depende do relógio do cliente; aceita resposta anterior ao prazo enviada depois", async () => {
    const id = await start(alice, { mode: "custom", board: "ENEM", topics: ["Funções"], count: 2, minutes: 10 });
    const [qa, qb] = (await c.query("select question_id from attempt_questions where attempt_id=$1 order by position", [id])).rows.map((r) => r.question_id);
    const t0 = now();
    await sync(alice, id, [op(qa, "choice", "A", t0)]); // certa
    // o tempo passa: força o prazo para o passado (como se estivesse offline por 10+ min)
    await c.query("update exam_attempts set deadline_at = now() - interval '1 minute' where id=$1", [id]);
    // resposta dada ANTES do prazo, enviada só agora (offline): aceita
    const r = await sync(alice, id, [op(qb, "choice", "B", Date.now() - 120_000)]);
    expect(r.status).toBe("expired");
    expect(r.applied).toHaveLength(1);
    const s = await state(alice, id);
    expect(s.attempt.status).toBe("expired");
    expect(s.attempt.score).toMatchObject({ total: 2, correct: 1, wrong: 1, blank: 0 });
    // resposta dada DEPOIS do prazo: rejeitada
    const late = await sync(alice, id, [op(qb, "choice", "A", Date.now() + 30_000)]);
    expect(late.rejected[0].reason).toBe("late");
  });

  it("aluno só lê o gabarito de questões respondidas e conforme o modo", async () => {
    const id = await start(alice, { mode: "custom", board: "ENEM", topics: ["Geometria"], count: 2, minutes: 60 });
    const [qa, qb] = (await c.query("select question_id from attempt_questions where attempt_id=$1 order by position", [id])).rows.map((r) => r.question_id);
    const keys = (user: string) => asUser(c, user, async () => (await c.query("select question_id from answer_keys where question_id = any($1)", [[qa, qb]])).rows);
    expect(await keys(alice)).toHaveLength(0); // não respondeu
    await sync(alice, id, [op(qa, "choice", "C", now())]);
    expect(await keys(alice)).toHaveLength(0); // simulado em andamento: ainda não
    await callAs(c, alice, "select public.finish_attempt($1)", [id]);
    expect((await keys(alice)).map((k) => k.question_id)).toEqual([qa]); // só a respondida
    expect(await keys(bob)).toHaveLength(0); // outro aluno não
  });

  it("treino dá feedback imediato após responder", async () => {
    const id = await start(bob, { mode: "treino", board: "ENEM", topics: ["Funções"], count: 1 });
    const qa = (await c.query("select question_id from attempt_questions where attempt_id=$1", [id])).rows[0].question_id;
    const keys = () => asUser(c, bob, async () => (await c.query("select correct_label from answer_keys where question_id=$1", [qa])).rows);
    expect(await keys()).toHaveLength(0);
    await sync(bob, id, [op(qa, "choice", "B", now())]);
    expect(await keys()).toEqual([{ correct_label: "A" }]);
  });

  it("finish_attempt é idempotente e bloqueia novas operações", async () => {
    const id = await start(alice, { mode: "custom", board: "ENEM", count: 1, minutes: 30 });
    const a = (await callAs<{ r: any }[]>(c, alice, "select public.finish_attempt($1) r", [id]))[0].r;
    const b = (await callAs<{ r: any }[]>(c, alice, "select public.finish_attempt($1) r", [id]))[0].r;
    expect(a.status).toBe("finished");
    expect(b.score).toEqual(a.score);
    const qa = (await c.query("select question_id from attempt_questions where attempt_id=$1", [id])).rows[0].question_id;
    expect((await sync(alice, id, [op(qa, "choice", "A", now())])).rejected[0].reason).toBe("finished");
  });
});

describe("caderno de erros (repetição espaçada)", () => {
  it("erros entram no caderno; revisão certa avança a caixa e erra volta à 1", async () => {
    const qz = await qid(2); // gabarito B
    const id = await start(bob, { mode: "simulado", exam_id: examId, language: "ingles" });
    await sync(bob, id, [op(qz, "choice", "C", now())]); // errou
    await callAs(c, bob, "select public.finish_attempt($1)", [id]);
    const nb = (await c.query("select box, resolved_at from error_notebook where user_id=$1 and question_id=$2", [bob, qz])).rows[0];
    expect(nb).toMatchObject({ box: 1, resolved_at: null });
    // ainda não venceu (próxima revisão em 1 dia)
    await expect(start(bob, { mode: "revisao" })).rejects.toThrow(/no_errors_due/);
    await c.query("update error_notebook set next_review_at = now() - interval '1 hour' where user_id=$1", [bob]);

    const rev = await start(bob, { mode: "revisao" });
    await sync(bob, rev, [op(qz, "choice", "B", now())]); // acertou na revisão
    await callAs(c, bob, "select public.finish_attempt($1)", [rev]);
    expect((await c.query("select box from error_notebook where user_id=$1 and question_id=$2", [bob, qz])).rows[0].box).toBe(2);
    // intervalo da caixa 2 = 3 dias
    const days = (await c.query("select extract(epoch from next_review_at - now())/86400 d from error_notebook where user_id=$1 and question_id=$2", [bob, qz])).rows[0].d;
    expect(Number(days)).toBeGreaterThan(2.9);
    expect(Number(days)).toBeLessThan(3.1);

    // errar de novo na revisão volta para a caixa 1
    await c.query("update error_notebook set next_review_at = now() - interval '1 hour' where user_id=$1", [bob]);
    const rev2 = await start(bob, { mode: "revisao" });
    await sync(bob, rev2, [op(qz, "choice", "A", now())]);
    await callAs(c, bob, "select public.finish_attempt($1)", [rev2]);
    expect((await c.query("select box from error_notebook where user_id=$1 and question_id=$2", [bob, qz])).rows[0].box).toBe(1);
  });

  it("acertar 5 revisões resolve o erro", async () => {
    const qz = await qid(3);
    await c.query("insert into error_notebook (user_id, question_id, box, next_review_at) values ($1,$2,5, now() - interval '1 day') on conflict (user_id, question_id) do update set box=5, next_review_at = now() - interval '1 day', resolved_at = null", [alice, qz]);
    const rev = await start(alice, { mode: "revisao" });
    await sync(alice, rev, [op(qz, "choice", "C", now())]);
    await callAs(c, alice, "select public.finish_attempt($1)", [rev]);
    expect((await c.query("select resolved_at from error_notebook where user_id=$1 and question_id=$2", [alice, qz])).rows[0].resolved_at).not.toBeNull();
  });

  it("aluno só vê o próprio caderno", async () => {
    const mine = await asUser(c, bob, async () => (await c.query("select user_id from error_notebook")).rows);
    expect(mine.every((r) => r.user_id === bob)).toBe(true);
  });
});

describe("refazer erros e facetas", () => {
  it("retry_attempt traz só o que errou ou deixou em branco", async () => {
    const id = await start(alice, { mode: "custom", board: "ENEM", topics: ["Funções"], count: 3, minutes: 30 });
    const qs = (await c.query("select aq.question_id, q.number from attempt_questions aq join questions q on q.id=aq.question_id where aq.attempt_id=$1 order by aq.position", [id])).rows;
    await sync(alice, id, [op(qs[0].question_id, "choice", "A", now()), op(qs[1].question_id, "choice", "B", now())]); // gabarito A: acerta a 1ª, erra a 2ª; 3ª em branco
    await callAs(c, alice, "select public.finish_attempt($1)", [id]);
    const retry = await start(alice, { mode: "treino", retry_attempt: id });
    const got = (await c.query("select question_id from attempt_questions where attempt_id=$1", [retry])).rows.map((r) => r.question_id).sort();
    expect(got).toEqual([qs[1].question_id, qs[2].question_id].sort());
    // não pode refazer tentativa de outro aluno nem em andamento
    await expect(start(bob, { mode: "treino", retry_attempt: id })).rejects.toThrow(/não encontrada/);
  });

  it("bank_facets lista disciplinas, assuntos e áreas", async () => {
    const f = (await callAs<{ f: any }[]>(c, alice, "select public.bank_facets() f"))[0].f;
    expect(f.subjects.map((s: any) => s.name)).toContain("Matemática");
    expect(f.topics.map((s: any) => s.name)).toEqual(expect.arrayContaining(["Funções", "Geometria"]));
    expect(f.areas.map((s: any) => s.name)).toContain("matematica");
  });
});

describe("pausa", () => {
  it("pausar congela o prazo e retomar o desloca pelo tempo parado", async () => {
    const id = await start(alice, { mode: "custom", board: "ENEM", count: 1, minutes: 30 });
    const before = Number((await state(alice, id)).attempt.deadline_at);
    await callAs(c, alice, "select public.pause_attempt($1)", [id]);
    await c.query("update exam_attempts set paused_at = now() - interval '10 minutes' where id=$1", [id]);
    const s = (await callAs<{ r: any }[]>(c, alice, "select public.resume_attempt($1) r", [id]))[0].r;
    expect(s.attempt.status).toBe("in_progress");
    expect(Number(s.attempt.deadline_at) - before).toBeGreaterThan(9 * 60_000);
  });
});
