import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { callAs, connect, createUser, resetDb, seedBundle } from "./helpers";

let c: Client;
let ana: string, bia: string, caio: string, adm: string;
const qid: Record<number, string> = {};

const alts = ["A", "B", "C", "D", "E"].map((label) => ({ label, text_md: `alt ${label}` }));
const q = (number: number, subject: string, topic: string, area: string) => ({
  number, area, subject, topic, statement_md: `Questão ${number}`, alternatives: alts, correct: "A", explanation_md: "porque A",
});

/** Respostas diretas no banco: `days` dias atrás (meio-dia de SP), certas ou erradas. */
async function answer(user: string, plan: { n: number; daysAgo: number; ok: boolean }[]) {
  const { rows } = await c.query("insert into exam_attempts (user_id, mode, title) values ($1, 'treino', 'Treino') returning id", [user]);
  for (const p of plan) {
    await c.query(
      `insert into attempt_answers (attempt_id, question_id, choice, time_spent_ms, answered_at)
       values ($1, $2, $3, 60000, ((now() at time zone 'America/Sao_Paulo')::date - $4::int + time '12:00') at time zone 'America/Sao_Paulo')`,
      [rows[0].id, qid[p.n], p.ok ? "A" : "B", p.daysAgo],
    );
  }
}

beforeAll(async () => {
  c = await connect();
  await resetDb(c);
  [ana, bia, caio] = [await createUser(c, "ana@x.com"), await createUser(c, "bia@x.com"), await createUser(c, "caio@x.com")];
  adm = await createUser(c, "adm@x.com", "admin");
  const qs = Array.from({ length: 30 }, (_, i) => i < 15 ? q(i + 1, "Matemática", "Funções", "matematica") : q(i + 1, "História", "Era Vargas", "humanas"));
  await seedBundle(c, { board: "ENEM", exams: [{ name: "ENEM 2023", year: 2023, questions: qs }] });
  for (const r of (await c.query("select id, number from questions")).rows) qid[r.number] = r.id;
  // Ana: estuda quase todo dia (14 dias), forte em História e fraca em Matemática
  const plan: { n: number; daysAgo: number; ok: boolean }[] = [];
  for (let d = 0; d < 14; d++) plan.push({ n: 1 + (d % 15), daysAgo: d, ok: d % 3 === 0 }, { n: 16 + (d % 15), daysAgo: d, ok: true });
  await answer(ana, plan);
  // Bia: estudou há 20 dias e parou
  await answer(bia, [{ n: 1, daysAgo: 20, ok: true }, { n: 2, daysAgo: 20, ok: false }]);
  // Caio: nunca respondeu
});
afterAll(() => c.end());

const cohort = () => callAs<{ r: Record<string, unknown> }[]>(c, adm, "select public.admin_cohort(null) r").then((x) => x[0].r as Record<string, any>); // eslint-disable-line @typescript-eslint/no-explicit-any

describe("análise do admin", () => {
  it("só admin acessa", async () => {
    await expect(callAs(c, ana, "select public.admin_cohort(null)")).rejects.toThrow(/permission denied/);
    await expect(callAs(c, ana, "select public.admin_student_rhythm($1, null)", [bia])).rejects.toThrow(/permission denied/);
  });

  it("turma: ativos, ritmo de cada um e assuntos fortes/fracos", async () => {
    const r = await cohort();
    expect(r.totals).toMatchObject({ students: 3, active7: 1, active30: 2 });
    const byId = Object.fromEntries((r.students as { id: string; segment: string; days28: number; weakest: string | null; strongest: string | null }[]).map((s) => [s.id, s]));
    expect(byId[ana]).toMatchObject({ segment: "constante", days28: 14, weakest: "Funções", strongest: "Era Vargas" });
    expect(byId[bia].segment).toBe("parado");
    expect(byId[caio].segment).toBe("nunca");
    expect(r.segments).toMatchObject({ constante: 1, parado: 1, nunca: 1 });
    expect(r.weak_topics[0].key).toBe("Funções");
    expect(r.strong_topics[0].key).toBe("Era Vargas");
    expect(r.daily).toHaveLength(30);
    expect(r.hours[12]).toBeGreaterThan(0);
  });

  it("aluno: calendário de 12 semanas, horários e resumo", async () => {
    const [{ r }] = await callAs<{ r: Record<string, any> }[]>(c, adm, "select public.admin_student_rhythm($1, null) r", [ana]); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(r.calendar).toHaveLength(84);
    expect(r.calendar.at(-1).answers).toBe(2);
    expect(r.summary).toMatchObject({ days28: 14, segment: "constante", per_day: 2, min_per_day: 2 });
    expect(r.subjects[0].key).toBe("Matemática");
    expect(r.hours[12]).toBe(28);
  });
});
