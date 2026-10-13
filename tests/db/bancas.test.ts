import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { callAs, connect, createUser, resetDb, seedBundle } from "./helpers";

let c: Client;
let ana: string;

const alts = ["A", "B", "C", "D", "E"].map((label) => ({ label, text_md: `alt ${label}` }));
const q = (number: number, extra: Record<string, unknown> = {}) => ({
  number, subject: "Língua Portuguesa", statement_md: `Questão ${number}`, alternatives: alts, correct: "A", explanation_md: "porque A", ...extra,
});

beforeAll(async () => {
  c = await connect();
  await resetDb(c);
  ana = await createUser(c, "ana@x.com");
  // UFPR: língua estrangeira em 7 idiomas (83–90)
  await seedBundle(c, {
    board: "UFPR",
    exams: [{
      name: "UFPR 2025 — 1ª fase", year: 2025, format: "UFPR_2fases_ate_2026",
      questions: [q(1, { area: "linguagens" }), q(83, { language: "frances", area: "linguagens" }), q(83, { language: "japones", area: "linguagens" })],
    }],
  });
  // Concurso: as questões comuns (mesmo external_id) entram uma vez e ficam nas duas provas
  const comum = [q(1, { external_id: "tae-comum-q01" }), q(2, { external_id: "tae-comum-q02" })];
  await seedBundle(c, {
    board: "CONCURSO",
    exams: [
      { name: "UFPR TAE 2024 — Técnico em Contabilidade", year: 2024, format: "NCUFPR_medio_40", questions: [...comum, q(31, { external_id: "tae-403-q31", subject: "Técnico em Contabilidade" })] },
      { name: "UFPR TAE 2024 — Técnico em Enfermagem", year: 2024, format: "NCUFPR_medio_40", questions: [...comum, q(31, { external_id: "tae-404-q31", subject: "Técnico em Enfermagem" })] },
    ],
  });
});
afterAll(() => c.end());

const start = (p: Record<string, unknown>) =>
  callAs<{ id: string }[]>(c, ana, "select public.start_attempt($1::jsonb) id", [JSON.stringify(p)]).then((r) => r[0].id);
const examId = async (name: string) => (await c.query("select id from exams where name = $1", [name])).rows[0].id as string;
const picked = async (attempt: string) =>
  (await c.query("select q.number, q.language from attempt_questions aq join questions q on q.id = aq.question_id where aq.attempt_id = $1 order by aq.position", [attempt])).rows;

describe("UFPR: as 7 línguas estrangeiras", () => {
  it("aceita francês e japonês e recusa idioma desconhecido", async () => {
    const { rows } = await c.query("select language from questions where language is not null order by language");
    expect(rows.map((r) => r.language)).toEqual(["frances", "japones"]);
    await expect(c.query("update questions set language = 'klingon' where language = 'frances'")).rejects.toThrow(/questions_language_check/);
  });

  it("simulado pede o idioma e monta só com a língua escolhida; 5h30 de prova", async () => {
    const exam = await examId("UFPR 2025 — 1ª fase");
    await expect(start({ mode: "simulado", exam_id: exam })).rejects.toThrow(/language_required/);
    const id = await start({ mode: "simulado", exam_id: exam, language: "japones" });
    expect(await picked(id)).toEqual([{ number: 1, language: null }, { number: 83, language: "japones" }]);
    const { rows } = await c.query("select (config ->> 'minutes')::int m from exam_attempts where id = $1", [id]);
    expect(rows[0].m).toBe(330);
    await expect(start({ mode: "simulado", exam_id: exam, language: "klingon" })).rejects.toThrow(/idioma inválido/);
  });
});

describe("concursos", () => {
  it("banca de concurso existe e as questões comuns não se duplicam", async () => {
    const { rows: b } = await c.query("select kind from exam_boards where code = 'CONCURSO'");
    expect(b[0].kind).toBe("concurso");
    const { rows } = await c.query("select count(*)::int n from questions q join exam_boards b on b.id = q.board_id where b.code = 'CONCURSO'");
    expect(rows[0].n).toBe(4); // 2 comuns + 1 específica de cada cargo
    const { rows: links } = await c.query("select count(*)::int n from exam_questions eq join questions q on q.id = eq.question_id where q.external_id = 'tae-comum-q01'");
    expect(links[0].n).toBe(2);
  });

  it("simulado de um cargo traz as comuns e as específicas dele, em 4h", async () => {
    const id = await start({ mode: "simulado", exam_id: await examId("UFPR TAE 2024 — Técnico em Enfermagem") });
    expect((await picked(id)).map((r) => r.number)).toEqual([1, 2, 31]);
    const { rows } = await c.query(
      "select q.subject, (a.config ->> 'minutes')::int m from attempt_questions aq join questions q on q.id = aq.question_id join exam_attempts a on a.id = aq.attempt_id where aq.attempt_id = $1 and q.number = 31",
      [id],
    );
    expect(rows[0]).toEqual({ subject: "Técnico em Enfermagem", m: 240 });
  });

  it("treino filtra pela banca de concurso", async () => {
    const id = await start({ mode: "treino", board: "CONCURSO", count: 10 });
    expect(await picked(id)).toHaveLength(4);
  });
});
