import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { PLANS } from "../../src/lib/plans";
import { asUser, callAs, connect, createUser, resetDb, seedBundle } from "./helpers";

let c: Client;
let admin: string, ana: string, bia: string;
let examId: string;
const alts = ["A", "B", "C", "D", "E"].map((label) => ({ label, text_md: `alt ${label}` }));
const ent = async (user: string, f: string) => (await callAs<{ r: any }[]>(c, user, "select public.entitlement($1) r", [f]))[0].r;

beforeAll(async () => {
  c = await connect();
  await resetDb(c);
  admin = await createUser(c, "admin@x.com", "admin");
  ana = await createUser(c, "ana@x.com");
  bia = await createUser(c, "bia@x.com");
  await seedBundle(c, { board: "ENEM", exams: [{ name: "ENEM 2023 — Dia 2", year: 2023, format: "ENEM_dia2",
    questions: [1, 2].map((n) => ({ number: n, area: "matematica", statement_md: `Q${n}`, alternatives: alts, correct: "A", explanation_md: "porque" })) }] });
  examId = (await c.query("select id from exams limit 1")).rows[0].id;
});
afterAll(() => c.end());

describe("planos e limites", () => {
  it("o espelho em src/lib/plans.ts bate com o seed do banco", async () => {
    const { rows } = await c.query("select p.code, p.price_cents, p.price_year_cents, l.feature, l.period, l.quota from plans p join plan_limits l on l.plan_code = p.code");
    for (const p of PLANS) {
      const mine = rows.filter((r) => r.code === p.code);
      expect(mine[0]?.price_cents).toBe(p.priceCents);
      expect(mine[0]?.price_year_cents).toBe(p.priceYearCents);
      for (const r of mine) expect(p.limits[r.feature as keyof typeof p.limits]).toEqual({ period: r.period, quota: r.quota });
      expect(mine.length).toBe(Object.keys(p.limits).length);
    }
  });

  it("conta nova ganha 7 dias de Pro; depois do trial cai para o Grátis", async () => {
    expect((await ent(ana, "essay_ai"))).toMatchObject({ plan: "pro", period: "day", quota: 2 });
    await c.query("update subscriptions set trial_end = now() - interval '1 minute' where user_id = $1", [ana]);
    expect((await ent(ana, "essay_ai"))).toMatchObject({ plan: "free", period: "week", quota: 1, used: 0 });
    const q = (await callAs<{ r: any }[]>(c, ana, "select public.ai_quota() r"))[0].r;
    expect(q).toMatchObject({ limit: 1, used: 0, unlimited: false, period: "week", plan: "free" });
  });

  it("Grátis: 1 simulado por prova no mês; treino não conta", async () => {
    await callAs(c, ana, "select public.start_attempt($1::jsonb)", [JSON.stringify({ mode: "simulado", exam_id: examId })]);
    await expect(callAs(c, ana, "select public.start_attempt($1::jsonb)", [JSON.stringify({ mode: "simulado", exam_id: examId })])).rejects.toThrow(/plan_limit:simulado/);
    await expect(callAs(c, ana, "select public.start_attempt($1::jsonb)", [JSON.stringify({ mode: "treino", count: 2 })])).resolves.toBeTruthy();
    expect((await ent(ana, "simulado"))).toMatchObject({ quota: 1, used: 1, remaining: 0 });
    // mês passado não conta
    await c.query("update usage_events set at = now() - interval '40 days' where user_id = $1", [ana]);
    await expect(callAs(c, ana, "select public.start_attempt($1::jsonb)", [JSON.stringify({ mode: "simulado", exam_id: examId })])).resolves.toBeTruthy();
  });

  it("limite personalizado por usuário vence o do plano; admin é ilimitado", async () => {
    await c.query("insert into user_limit_overrides (user_id, feature, period, quota) values ($1, 'simulado', 'month', null)", [ana]);
    expect((await ent(ana, "simulado"))).toMatchObject({ unlimited: true, quota: null });
    expect((await ent(admin, "tutor_msg"))).toMatchObject({ unlimited: true });
  });

  it("assinatura ativa vale até o vencimento; cortesia sem vencimento vale sempre", async () => {
    await c.query("update subscriptions set plan_code='estudante', status='active', trial_end=null, current_period_end = now() + interval '3 days' where user_id=$1", [bia]);
    expect((await ent(bia, "tutor_msg"))).toMatchObject({ plan: "estudante", quota: 40 });
    await c.query("update subscriptions set current_period_end = now() - interval '1 day' where user_id=$1", [bia]);
    expect((await ent(bia, "tutor_msg"))).toMatchObject({ plan: "free", quota: 5 });
    await c.query("update subscriptions set plan_code='familia', current_period_end = null where user_id=$1", [bia]);
    expect((await ent(bia, "export"))).toMatchObject({ plan: "familia", unlimited: true });
  });

  it("RLS: cada um vê só a própria assinatura e não escreve uso nem plano", async () => {
    const subs = await asUser(c, ana, async () => (await c.query("select user_id from subscriptions")).rows);
    expect(subs.map((r) => r.user_id)).toEqual([ana]);
    await expect(asUser(c, ana, () => c.query("insert into usage_events (user_id, feature) values ($1, 'export')", [ana]))).rejects.toThrow(/row-level security|permission denied/);
    const upd = await asUser(c, ana, () => c.query("update subscriptions set plan_code='pro' where user_id=$1", [ana]));
    expect(upd.rowCount).toBe(0);
    await expect(callAs(c, ana, "select public._consume($1, 'export')", [ana])).rejects.toThrow(/permission denied/);
    const plans = (await c.query("set role anon; select count(*)::int n from plans; ")) as any;
    await c.query("reset role");
    expect(plans[1].rows[0].n).toBe(4);
  });

  it("my_plan resume plano e limites", async () => {
    const r = (await callAs<{ r: any }[]>(c, bia, "select public.my_plan() r"))[0].r;
    expect(r.plan).toBe("familia");
    expect(Object.keys(r.limits).sort()).toEqual(["essay_ai", "export", "simulado", "transcribe", "tutor_msg"]);
    expect(r.subscription.provider_sub_id).toBeUndefined();
  });
});
