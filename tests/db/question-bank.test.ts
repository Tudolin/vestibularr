import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, connect, createUser, resetDb } from "./helpers";

let c: Client;
let admin: string, alice: string;

const alts = (n: number) => ["A", "B", "C", "D", "E"].slice(0, n).map((label) => ({ label, text_md: `alt ${label}` }));
const bundle = (over: Record<string, unknown> = {}) => ({
  board: "ENEM",
  exams: [
    {
      name: "ENEM 2023 — Dia 2", year: 2023, format: "ENEM_dia2", pdf_url: "https://x.test/p.pdf",
      questions: [
        { number: 1, area: "matematica", statement_md: "Q1 sobre funções", alternatives: alts(5), correct: "C", explanation_md: "porque C" },
        { number: 2, area: "natureza", statement_md: "Q2 sobre célula", alternatives: alts(5), correct: "A" },
        { number: 1, language: "ingles", area: "linguagens", statement_md: "Q1 inglês", alternatives: alts(5), correct: "B" },
        { number: 1, language: "espanhol", area: "linguagens", statement_md: "Q1 espanhol", alternatives: alts(5), correct: "D" },
      ],
    },
  ],
  questions: [{ external_id: "x:1", kind: "discursive", statement_md: "Explique a fotossíntese", official_mirror_md: "espelho", max_score: 5, work: "Vidas Secas" }],
  ...over,
});

beforeAll(async () => {
  c = await connect();
  await resetDb(c);
  admin = await createUser(c, "admin@x.com", "admin");
  alice = await createUser(c, "alice@x.com");
});
afterAll(() => c.end());

const imp = (user: string, b: unknown) =>
  asUser(c, user, async () => (await c.query("select public.import_bundle($1::jsonb) as r", [JSON.stringify(b)])).rows[0].r);

describe("import_bundle", () => {
  it("aluno não pode importar", async () => {
    await expect(imp(alice, bundle())).rejects.toThrow(/permission denied/);
  });

  it("admin importa provas, questões, gabarito, obra e vínculo prova↔questão", async () => {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [admin]);
    const r = (await c.query("select public.import_bundle($1::jsonb) as r", [JSON.stringify(bundle())])).rows[0].r;
    await c.query("commit");
    expect(r).toEqual({ exams: 1, inserted: 5, updated: 0 });
    const { rows: counts } = await c.query(`
      select (select count(*) from questions)::int q, (select count(*) from alternatives)::int a,
             (select count(*) from answer_keys)::int k, (select count(*) from exam_questions)::int eq,
             (select count(*) from literary_works)::int w`);
    expect(counts[0]).toEqual({ q: 5, a: 20, k: 5, eq: 4, w: 1 });
    const { rows } = await c.query("select year, format_id is not null as has_format from exams");
    expect(rows[0]).toEqual({ year: 2023, has_format: true });
  });

  it("é idempotente: reimportar atualiza em vez de duplicar", async () => {
    const b = bundle();
    (b.exams[0].questions[0] as { statement_md: string }).statement_md = "Q1 reescrita";
    const r = await asUserCommit(admin, b);
    expect(r).toEqual({ exams: 1, inserted: 0, updated: 5 });
    const { rows } = await c.query("select count(*)::int n from questions");
    expect(rows[0].n).toBe(5);
    const q1 = await c.query("select statement_md from questions where number = 1 and language is null");
    expect(q1.rows[0].statement_md).toBe("Q1 reescrita");
  });

  it("é atômico: erro no meio desfaz tudo", async () => {
    const before = (await c.query("select count(*)::int n from questions")).rows[0].n;
    const bad = bundle({ board: "ENEM", exams: [{ name: "Quebra", year: 2020, questions: [
      { number: 1, statement_md: "ok", alternatives: alts(2), correct: "A" },
      { number: 2, statement_md: "x", kind: "inválido", alternatives: alts(2), correct: "A" },
    ] }], questions: [] });
    await expect(asUserCommit(admin, bad)).rejects.toThrow();
    expect((await c.query("select count(*)::int n from questions")).rows[0].n).toBe(before);
    expect((await c.query("select count(*)::int n from exams where name = 'Quebra'")).rows[0].n).toBe(0);
  });

  it("service-role também pode importar (seed)", async () => {
    await c.query("begin");
    await c.query("set local role service_role");
    await c.query(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
    const r = (await c.query("select public.import_bundle($1::jsonb) as r", [JSON.stringify({ board: "UFPR", questions: [{ external_id: "u:1", statement_md: "s", alternatives: alts(4), correct: "A" }] })])).rows[0].r;
    await c.query("commit");
    expect(r.inserted).toBe(1);
  });

  it("reimportar sem resolução não apaga a que já existe", async () => {
    const b = bundle();
    delete (b.exams[0].questions[0] as { explanation_md?: string }).explanation_md;
    await asUserCommit(admin, b);
    const { rows } = await c.query("select k.explanation_md from answer_keys k join questions q on q.id = k.question_id where q.number = 1 and q.language is null and q.exam_id is not null");
    expect(rows[0].explanation_md).toBe("porque C");
  });
});

describe("apply_explanations", () => {
  const apply = (user: string, p: unknown) =>
    asUser(c, user, async () => (await c.query("select public.apply_explanations($1::jsonb) as r", [JSON.stringify(p)])).rows[0].r);
  const expl = async (number: number, language: string | null) =>
    (await c.query("select k.explanation_md e from answer_keys k join questions q on q.id = k.question_id where q.year = 2023 and q.number = $1 and coalesce(q.language,'') = coalesce($2,'') and q.exam_id is not null", [number, language])).rows[0].e;

  it("aluno não pode aplicar", async () => {
    await expect(apply(alice, { board: "ENEM", year: 2023, items: [] })).rejects.toThrow(/permission denied/);
  });

  it("grava só quando o gabarito bate; lista divergências e ausentes", async () => {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [admin]);
    const r = (await c.query("select public.apply_explanations($1::jsonb) as r", [JSON.stringify({ board: "ENEM", year: 2023, items: [
      { number: 2, correct: "A", explanation_md: "Q2 resolvida" },
      { number: 1, language: "ingles", correct: "B", explanation_md: "inglês resolvida" },
      { number: 1, correct: "E", explanation_md: "errada" },
      { number: 99, correct: "A", explanation_md: "não existe" },
    ] })])).rows[0].r;
    await c.query("commit");
    expect(r).toEqual({ updated: 2, missing: ["99"], mismatch: ["1 (banco C, arquivo E)"] });
    expect(await expl(2, null)).toBe("Q2 resolvida");
    expect(await expl(1, "ingles")).toBe("inglês resolvida");
    expect(await expl(1, "espanhol")).toBeNull();
    expect(await expl(1, null)).toBe("porque C");
  });
});

async function asUserCommit(user: string, b: unknown) {
  await c.query("begin");
  try {
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
    const r = (await c.query("select public.import_bundle($1::jsonb) as r", [JSON.stringify(b)])).rows[0].r;
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback");
    throw e;
  }
}

describe("RLS do banco de questões", () => {
  it("aluno lê questões e alternativas, mas não o gabarito", async () => {
    const qs = await asUser(c, alice, async () => (await c.query("select id from questions")).rows);
    expect(qs.length).toBeGreaterThan(0);
    const alt = await asUser(c, alice, async () => (await c.query("select id from alternatives")).rows);
    expect(alt.length).toBeGreaterThan(0);
    const keys = await asUser(c, alice, async () => (await c.query("select * from answer_keys")).rows);
    expect(keys).toHaveLength(0);
    const adminKeys = await asUser(c, admin, async () => (await c.query("select * from answer_keys")).rows);
    expect(adminKeys.length).toBeGreaterThan(0);
  });

  it("aluno não escreve em questões, provas nem obras", async () => {
    for (const sql of [
      "update questions set statement_md = 'hack'",
      "delete from exams",
      "update literary_works set title = 'x'",
      "update answer_keys set correct_label = 'A'",
    ]) {
      const r = await asUser(c, alice, () => c.query(sql));
      expect(r.rowCount, sql).toBe(0);
    }
    await expect(
      asUser(c, alice, () => c.query("insert into questions (board_id, statement_md) select id, 'x' from exam_boards limit 1")),
    ).rejects.toThrow(/row-level security/);
  });

  it("questão desativada some para o aluno, não para o admin", async () => {
    await c.query("update questions set is_active = false where number = 2");
    const a = await asUser(c, alice, async () => (await c.query("select id from questions where number = 2")).rows);
    const ad = await asUser(c, admin, async () => (await c.query("select id from questions where number = 2")).rows);
    expect(a).toHaveLength(0);
    expect(ad).toHaveLength(1);
    await c.query("update questions set is_active = true");
  });

  it("busca em português ignora plural regular (células ~ célula)", async () => {
    const { rows } = await c.query("select number from questions where search @@ websearch_to_tsquery('portuguese', 'células')");
    expect(rows.length).toBe(1);
  });

  it("aluno envia prova para aprovação, só como pendente e só em seu nome", async () => {
    const ok = await asUser(c, alice, () => c.query("insert into question_imports (submitted_by, payload) values ($1, '{}')", [alice]));
    expect(ok.rowCount).toBe(1);
    await expect(asUser(c, alice, () => c.query("insert into question_imports (submitted_by, payload, status) values ($1, '{}', 'approved')", [alice]))).rejects.toThrow(/row-level security/);
    await expect(asUser(c, alice, () => c.query("insert into question_imports (submitted_by, payload) values ($1, '{}')", [admin]))).rejects.toThrow(/row-level security/);
  });

  it("aluno não aprova o próprio envio; admin vê e aprova", async () => {
    await c.query("insert into question_imports (submitted_by, payload) values ($1, '{}')", [alice]);
    const self = await asUser(c, alice, () => c.query("update question_imports set status = 'approved'"));
    expect(self.rowCount).toBe(0);
    const seen = await asUser(c, admin, async () => (await c.query("select id from question_imports")).rows);
    expect(seen.length).toBeGreaterThan(0);
    const approve = await asUser(c, admin, () => c.query("update question_imports set status = 'approved'"));
    expect(approve.rowCount).toBeGreaterThan(0);
  });
});
