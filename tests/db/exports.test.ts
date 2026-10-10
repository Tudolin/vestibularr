import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, callAs, connect, createUser, resetDb, seedBundle } from "./helpers";

let c: Client;
let ana: string, bia: string;

const alts = ["A", "B", "C", "D", "E"].map((label) => ({ label, text_md: `alt ${label}` }));
const q = (number: number, area: string, subject: string, correct: string) => ({
  number, area, subject, statement_md: `Questão ${number}`, alternatives: alts, correct, explanation_md: `porque ${correct}`,
});

beforeAll(async () => {
  c = await connect();
  await resetDb(c);
  ana = await createUser(c, "ana@x.com");
  bia = await createUser(c, "bia@x.com");
  const qs = Array.from({ length: 30 }, (_, i) => i < 15 ? q(i + 1, "matematica", "Matemática", "A") : q(i + 1, "humanas", "História", "B"));
  await seedBundle(c, { board: "ENEM", exams: [{ name: "ENEM 2023", year: 2023, format: "ENEM_dia2", questions: qs }] });
  // Ana no plano Grátis (5 por mês, até 20 questões)
  await c.query("update subscriptions set trial_end = now() - interval '1 minute' where user_id = $1", [ana]);
});
afterAll(() => c.end());

const create = (u: string, p: Record<string, unknown>) =>
  callAs<{ id: string }[]>(c, u, "select public.export_create($1::jsonb) id", [JSON.stringify(p)]).then((r) => r[0].id);
const content = (u: string, id: string) =>
  asUser(c, u, async () => (await c.query("select public.export_content($1) r", [id])).rows[0].r);

describe("exportar PDF/EPUB", () => {
  it("cria a lista com filtros, ordena por área/assunto e traz gabarito e resolução", async () => {
    const id = await create(ana, { subjects: ["História"], count: 5 });
    const r = await content(ana, id);
    expect(r.questions).toHaveLength(5);
    expect(r.questions.every((x: { subject: string }) => x.subject === "História")).toBe(true);
    expect(r.questions[0].correct_label).toBe("B");
    expect(r.questions[0].explanation_md).toBe("porque B");
    expect(r.questions[0].alternatives).toHaveLength(5);
    const all = await content(ana, await create(ana, { count: 30 }));
    const areas = all.questions.map((x: { area: string }) => x.area);
    expect(areas.indexOf("humanas")).toBeLessThan(areas.indexOf("matematica")); // humanas antes de matemática
  });

  it("plano Grátis: no máximo 20 questões e 5 listas por mês", async () => {
    expect((await content(ana, await create(ana, { count: 30 }))).questions).toHaveLength(20);
    await create(ana, { count: 1 });
    await create(ana, { count: 1 }); // 5ª do mês
    await expect(create(ana, { count: 1 })).rejects.toThrow(/plan_limit:export/);
  });

  it("sem gabarito quando o aluno pede; ninguém lê a lista de outro", async () => {
    const id = await create(bia, { count: 3, with_answers: false });
    const r = await content(bia, id);
    expect(r.questions[0].correct_label).toBeNull();
    expect(r.questions[0].explanation_md).toBeNull();
    expect(await content(ana, id)).toBeNull();
    expect(await asUser(c, ana, async () => (await c.query("select id from exports where id = $1", [id])).rows)).toEqual([]);
  });

  it("caderno de erros vazio avisa; cartão-resposta vira simulado com as mesmas questões", async () => {
    await expect(create(bia, { source: "erros" })).rejects.toThrow(/no_errors/);
    const id = await create(bia, { count: 4, order: "aleatoria" });
    const [{ a }] = await callAs<{ a: string }[]>(c, bia, "select public.export_to_attempt($1) a", [id]);
    const got = (await c.query("select question_id from attempt_questions where attempt_id = $1 order by position", [a])).rows.map((r) => r.question_id);
    const want = (await c.query("select question_ids from exports where id = $1", [id])).rows[0].question_ids;
    expect(got).toEqual(want);
    expect((await c.query("select mode, user_id from exam_attempts where id = $1", [a])).rows[0]).toEqual({ mode: "custom", user_id: bia });
    await expect(callAs(c, ana, "select public.export_to_attempt($1)", [id])).rejects.toThrow(/não encontrada/);
  });
});
