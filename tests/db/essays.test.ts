import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, callAs, connect, createUser, resetDb } from "./helpers";

let c: Client;
let admin: string, alice: string, bob: string, themeEnem: string, themeUfpr: string;

beforeAll(async () => {
  c = await connect();
  await resetDb(c);
  admin = await createUser(c, "admin@x.com", "admin");
  alice = await createUser(c, "alice@x.com");
  bob = await createUser(c, "bob@x.com");
  themeEnem = (await c.query("select id from essay_themes where kind='enem' and year=2025")).rows[0].id;
  themeUfpr = (await c.query("select id from essay_themes where kind='ufpr' limit 1")).rows[0].id;
});
afterAll(() => c.end());

const one = async <T = any>(user: string, sql: string, params: unknown[] = []) => ((await callAs<any[]>(c, user, sql, params))[0] as any).r as T;
const startEssay = (u: string, t: string) => one<string>(u, "select public.start_essay($1) r", [t]);
const save = (u: string, e: string, text: string, ts: number, device = "pc") =>
  one<any>(u, "select public.save_essay_draft($1, $2, $3, $4) r", [e, text, ts, device]);
const versions = async (e: string) => (await c.query("select content, is_submission, device from essay_versions where essay_id=$1 order by created_at", [e])).rows;
const current = async (e: string) => (await c.query("select v.content from essays e join essay_versions v on v.id=e.current_version_id where e.id=$1", [e])).rows[0]?.content;

describe("temas e rubricas", () => {
  it("temas oficiais do ENEM 2009–2025 e propostas UFPR; rubricas ativas por tipo", async () => {
    const { rows } = await c.query("select count(*) filter (where kind='enem')::int enem, count(*) filter (where kind='ufpr')::int ufpr from essay_themes");
    expect(rows[0]).toEqual({ enem: 17, ufpr: 3 });
    const r = (await c.query("select kind, jsonb_array_length(criteria) n from rubrics where is_active order by kind")).rows;
    expect(r).toEqual([{ kind: "discursive", n: 2 }, { kind: "enem", n: 5 }, { kind: "ufpr", n: 6 }]);
    const ufprMax = (await c.query("select sum((c->>'max')::numeric) s from rubrics, jsonb_array_elements(criteria) c where kind='ufpr'")).rows[0].s;
    expect(Number(ufprMax)).toBe(1); // frações somam 100%
  });
  it("aluno não edita temas nem rubricas", async () => {
    expect((await asUser(c, alice, () => c.query("update essay_themes set title='x'"))).rowCount).toBe(0);
    expect((await asUser(c, alice, () => c.query("update rubrics set name='x'"))).rowCount).toBe(0);
  });
});

describe("rascunho: nunca perder texto", () => {
  it("start_essay reaproveita o rascunho aberto do mesmo tema", async () => {
    const a = await startEssay(alice, themeEnem);
    expect(await startEssay(alice, themeEnem)).toBe(a);
  });

  it("autosave do mesmo aparelho compacta; outro aparelho gera nova versão", async () => {
    const e = await startEssay(alice, themeUfpr);
    const t = Date.now();
    await save(alice, e, "Primeira", t, "pc");
    await save(alice, e, "Primeira frase", t + 2000, "pc");
    expect(await versions(e)).toHaveLength(1);
    await save(alice, e, "Do celular", t + 4000, "celular");
    expect((await versions(e)).map((v) => v.content)).toEqual(["Primeira frase", "Do celular"]);
    expect(await current(e)).toBe("Do celular");
  });

  it("substituir o texto (foto) ou apagar mais da metade gera NOVA versão, mesmo em < 2 min", async () => {
    const carol = await createUser(c, "carol@x.com");
    const e = await startEssay(carol, themeEnem);
    const t = Date.now() + 100_000;
    const long = "Texto digitado com bastante conteúdo para não ser perdido de jeito nenhum.";
    await save(carol, e, long, t, "pc");
    await one(carol, "select public.save_essay_draft($1, $2, $3, $4, 'photo') r", [e, "Texto vindo da foto", t + 1000, "pc"]);
    await save(carol, e, "Texto vindo da foto, editado", t + 2000, "pc"); // origem 'typed' ≠ 'photo' → nova
    await save(carol, e, "x", t + 3000, "pc"); // apagou quase tudo → nova
    const vs = (await versions(e)).map((v) => v.content);
    expect(vs).toEqual(expect.arrayContaining([long, "Texto vindo da foto", "Texto vindo da foto, editado", "x"]));
  });

  it("escrita mais antiga de outro aparelho (offline) vai para o histórico, sem substituir a atual", async () => {
    const e = await startEssay(bob, themeUfpr);
    const t = Date.now();
    await save(bob, e, "Texto novo no PC", t + 10_000, "pc");
    const r = await save(bob, e, "Texto velho do celular offline", t, "celular");
    expect(r.current).toBe(false);
    expect(await current(e)).toBe("Texto novo no PC");
    expect((await versions(e)).map((v) => v.content)).toContain("Texto velho do celular offline");
  });

  it("restaurar uma versão antiga cria nova versão (histórico intacto)", async () => {
    const e = await startEssay(bob, themeUfpr);
    const old = (await c.query("select id from essay_versions where essay_id=$1 and content like 'Texto velho%'", [e])).rows[0].id;
    const before = (await versions(e)).length;
    await one(bob, "select public.restore_essay_version($1, $2) r", [e, old]);
    expect(await current(e)).toBe("Texto velho do celular offline");
    expect((await versions(e)).length).toBe(before + 1);
  });

  it("dono errado e texto longo demais são barrados", async () => {
    const e = await startEssay(alice, themeEnem);
    await expect(save(bob, e, "x", Date.now())).rejects.toThrow(/not_found/);
    await expect(save(alice, e, "x".repeat(12001), Date.now())).rejects.toThrow(/longo/);
  });

  it("aluno não lê redação de outro, nem grava direto", async () => {
    const rows = await asUser(c, bob, async () => (await c.query("select user_id from essays")).rows);
    expect(rows.every((r) => r.user_id === bob)).toBe(true);
    await expect(asUser(c, alice, () => c.query("insert into essay_versions (essay_id, content, client_ts) select id, 'x', 1 from essays limit 1"))).rejects.toThrow(/row-level|permission/);
  });
});

describe("envio para correção e cota diária", () => {
  it("submit congela a versão, cria correção + trabalho, e bloqueia edição", async () => {
    const e = await startEssay(alice, themeEnem);
    await save(alice, e, "Texto da redação com conteúdo suficiente para enviar.", Date.now() + 50_000);
    const r = await one<any>(alice, "select public.submit_essay($1) r", [e]);
    expect(r.job_id).toBeTruthy();
    const corr = (await c.query("select status, rubric_id is not null has_rubric from essay_corrections where id=$1", [r.correction_id])).rows[0];
    expect(corr).toEqual({ status: "queued", has_rubric: true });
    expect((await versions(e)).at(-1)?.is_submission).toBe(true);
    await expect(save(alice, e, "mudança", Date.now() + 60_000)).rejects.toThrow(/essay_submitted/);
    // reabrir para reescrever
    await one(alice, "select public.reopen_essay($1) r", [e]);
    await save(alice, e, "Reescrita", Date.now() + 70_000);
    expect(await current(e)).toBe("Reescrita");
  });

  it("texto vazio não consome cota", async () => {
    const e = await startEssay(bob, themeEnem);
    await expect(one(bob, "select public.submit_essay($1) r", [e])).rejects.toThrow(/texto_vazio/);
    expect((await c.query("select count(*)::int n from ai_jobs where user_id=$1", [bob])).rows[0].n).toBe(0);
  });

  it("limite vem do plano (com override por usuário); falhas não contam; admin sem limite", async () => {
    await c.query("insert into user_limit_overrides (user_id, feature, period, quota) values ($1, 'transcribe', 'day', 2)", [bob]);
    await c.query("delete from ai_jobs where user_id=$1", [bob]);
    await one(bob, "select public.reserve_transcription() r");
    const j2 = await one<string>(bob, "select public.reserve_transcription() r");
    await expect(one(bob, "select public.reserve_transcription() r")).rejects.toThrow(/quota_exceeded/);
    await c.query("update ai_jobs set status='failed' where id=$1", [j2]); // falha nossa: devolve a cota
    await expect(one(bob, "select public.reserve_transcription() r")).resolves.toBeTruthy();
    const q = await one<any>(bob, "select public.entitlement('transcribe') r");
    expect(q).toMatchObject({ quota: 2, used: 2, unlimited: false, period: "day" });
    for (let i = 0; i < 4; i++) await one(admin, "select public.reserve_transcription() r");
    // trabalhos de ontem não contam
    await c.query("update ai_jobs set created_at = now() - interval '2 days' where user_id=$1", [bob]);
    expect((await one<any>(bob, "select public.entitlement('transcribe') r")).used).toBe(0);
    await c.query("delete from user_limit_overrides where user_id=$1", [bob]);
  });

  it("_reserve_ai_job não é chamável direto pelo aluno", async () => {
    await expect(callAs(c, alice, "select public._reserve_ai_job('essay', '{}')")).rejects.toThrow(/permission denied/);
  });
});

describe("permissões da correção", () => {
  it("aluno lê a própria correção mas não altera; admin só altera o comentário humano", async () => {
    const corr = (await c.query("select ec.id from essay_corrections ec join essays e on e.id=ec.essay_id where e.user_id=$1 limit 1", [alice])).rows[0].id;
    expect((await asUser(c, alice, async () => (await c.query("select id from essay_corrections")).rows)).length).toBeGreaterThan(0);
    expect((await asUser(c, bob, async () => (await c.query("select id from essay_corrections where id=$1", [corr])).rows))).toHaveLength(0);
    await expect(asUser(c, alice, () => c.query("update essay_corrections set total=1000 where id=$1", [corr]))).rejects.toThrow(/permission denied/);
    const ok = await asUser(c, admin, () => c.query("update essay_corrections set admin_comment='Boa!' , admin_comment_at=now() where id=$1", [corr]));
    expect(ok.rowCount).toBe(1);
    await expect(asUser(c, admin, () => c.query("update essay_corrections set total=999 where id=$1", [corr]))).rejects.toThrow(/permission denied/);
  });
});
