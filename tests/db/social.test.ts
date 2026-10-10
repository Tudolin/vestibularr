import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { callAs, connect, createUser, resetDb, seedBundle } from "./helpers";

let c: Client;
let ana: string, bia: string, caio: string, dani: string;
const alts = ["A", "B", "C", "D", "E"].map((label) => ({ label, text_md: label }));

beforeAll(async () => {
  c = await connect();
  await resetDb(c);
  ana = await createUser(c, "ana@x.com");
  bia = await createUser(c, "bia@x.com");
  caio = await createUser(c, "caio@x.com");
  dani = await createUser(c, "dani@x.com");
  await seedBundle(c, {
    board: "ENEM",
    questions: Array.from({ length: 60 }, (_, i) => ({
      external_id: `s${i}`, area: "matematica", subject: "Matemática", topic: "Funções", statement_md: `Q${i}`, alternatives: alts, correct: "A",
    })),
  });
  // dificuldade: s0–s19 fáceis (b<0), s20–s39 médias, s40–s59 difíceis
  await c.query(`update questions set irt_a = 2, irt_c = 0.2,
    irt_b = case when split_part(external_id, 's', 2)::int < 20 then -1 when split_part(external_id, 's', 2)::int < 40 then 1 else 2 end`);
});
afterAll(() => c.end());

const one = async (user: string, sql: string, params: unknown[] = []) => ((await callAs<any[]>(c, user, sql, params))[0] as any).r;
const xp = async (u: string) => Number((await c.query("select coalesce(sum(xp), 0) n from xp_events where user_id = $1", [u])).rows[0].n);
const qid = async (ext: string) => (await c.query("select id from questions where external_id = $1", [ext])).rows[0].id as string;

/** Treino com as questões dadas (por external_id); `right` = acerta. */
async function answer(user: string, exts: string[], right: boolean) {
  const id = await one(user, "select public.start_attempt($1::jsonb) r", [JSON.stringify({ mode: "treino", count: 1 })]);
  // troca as questões sorteadas pelas pedidas (o teste controla a dificuldade)
  await c.query("delete from attempt_questions where attempt_id = $1", [id]);
  for (const [i, e] of exts.entries()) await c.query("insert into attempt_questions (attempt_id, position, question_id) values ($1, $2, $3)", [id, i, await qid(e)]);
  const ops = await Promise.all(exts.map(async (e, i) => ({ op_id: randomUUID(), question_id: await qid(e), field: "choice", value: right ? "A" : "B", ts: Date.now() + i })));
  await one(user, "select public.sync_attempt($1, $2::jsonb) r", [id, JSON.stringify(ops)]);
  return id;
}

describe("XP", () => {
  it("acerto vale mais em questão difícil; erro vale um pouco; a mesma questão no mesmo dia não rende de novo", async () => {
    await answer(ana, ["s0"], true);      // fácil: 10
    expect(await xp(ana)).toBe(10);
    await answer(ana, ["s20", "s40"], true); // média 15 + difícil 20
    expect(await xp(ana)).toBe(45);
    await answer(ana, ["s1"], false);     // erro: 2
    expect(await xp(ana)).toBe(47);
    await answer(ana, ["s0", "s20"], true); // repetidas hoje: nada
    expect(await xp(ana)).toBe(47);
  });

  it("simulado encerrado: XP das respostas + bônus por terminar", async () => {
    const id = await one(bia, "select public.start_attempt($1::jsonb) r", [JSON.stringify({ mode: "custom", count: 12, minutes: 60 })]);
    const qs = (await c.query("select question_id from attempt_questions where attempt_id = $1", [id])).rows;
    const ops = qs.map((r, i) => ({ op_id: randomUUID(), question_id: r.question_id, field: "choice", value: "A", ts: Date.now() + i }));
    await one(bia, "select public.sync_attempt($1, $2::jsonb) r", [id, JSON.stringify(ops)]);
    expect(await xp(bia)).toBe(0); // no simulado o XP sai no fim
    await one(bia, "select public.finish_attempt($1) r", [id]);
    const got = await xp(bia);
    expect(got).toBeGreaterThanOrEqual(12 * 10 + 40);
    const feed = (await c.query("select kind from activity_events where user_id = $1", [bia])).rows.map((r) => r.kind);
    expect(feed).toContain("simulado");
  });

  it("teto diário de 2.000 XP", async () => {
    await c.query("insert into xp_events (user_id, source, xp, ref) values ($1, 'bonus', 1995, 'teste-teto')", [caio]);
    await answer(caio, ["s45"], true);
    expect(await xp(caio)).toBe(2000);
  });
});

describe("perfil social e amigos", () => {
  it("@apelido: formato, reservado e único", async () => {
    const av = JSON.stringify({ emoji: "🐱", color: "cobalto" });
    await expect(callAs(c, ana, "select public.social_set_profile('A!', $1::jsonb)", [av])).rejects.toThrow(/username_invalid/);
    await expect(callAs(c, ana, "select public.social_set_profile('admin_ana', $1::jsonb)", [av])).rejects.toThrow(/username_reserved/);
    expect((await one(ana, "select public.social_set_profile('Ana.Estuda', $1::jsonb) r", [av])).username).toBe("ana.estuda");
    await expect(callAs(c, bia, "select public.social_set_profile('ana.estuda', $1::jsonb)", [av])).rejects.toThrow(/username_taken/);
    await one(bia, "select public.social_set_profile('bia_vest', $1::jsonb) r", [JSON.stringify({ emoji: "🦊", color: "coral" })]);
    await one(caio, "select public.social_set_profile('caio', $1::jsonb) r", [av]);
    await one(dani, "select public.social_set_profile('dani', $1::jsonb) r", [av]);
  });

  it("busca devolve só campos públicos (sem nome nem e-mail)", async () => {
    const r = await one(ana, "select public.social_search('@bia') r");
    expect(r).toHaveLength(1);
    expect(Object.keys(r[0]).sort()).toEqual(["avatar", "id", "level", "relation", "requested_by_me", "streak", "username", "week_xp"]);
  });

  it("pedido, aceite, ranking da semana e pedido cruzado vira amizade", async () => {
    expect(await one(ana, "select public.friend_request('bia_vest') r")).toBe("pending");
    const inc = (await one(bia, "select public.social_overview() r")).incoming;
    expect(inc.map((x: any) => x.username)).toEqual(["ana.estuda"]);
    expect(await one(bia, "select public.friend_respond($1, 'accept') r", [ana])).toBe("accepted");
    const ov = await one(ana, "select public.social_overview() r");
    expect(ov.friends.map((x: any) => x.username)).toEqual(["bia_vest", "ana.estuda"]); // Bia tem mais XP na semana
    // Caio pede para Ana e Ana pede para Caio: vira amizade direto
    await one(caio, "select public.friend_request('ana.estuda') r");
    expect(await one(ana, "select public.friend_request('caio') r")).toBe("accepted");
  });

  it("bloquear esconde da busca e impede pedidos", async () => {
    await one(dani, "select public.friend_respond($1, 'block') r", [ana]);
    expect(await one(ana, "select public.social_search('dani') r")).toEqual([]);
    await expect(callAs(c, ana, "select public.friend_request('dani')")).rejects.toThrow(/user_not_found/);
  });
});

describe("boosts", () => {
  it("vento a favor: +50% de XP por 15 min; 1 por dia; só entre amigos", async () => {
    await expect(callAs(c, dani, "select public.send_boost($1, 'vento')", [bia])).rejects.toThrow(/not_allowed/);
    await one(ana, "select public.send_boost($1, 'vento') r", [bia]);
    await expect(callAs(c, ana, "select public.send_boost($1, 'vento')", [caio])).rejects.toThrow(/boost_used_today/);
    const before = await xp(bia);
    await answer(bia, ["s30"], true); // média: 15 × 1,5
    expect(await xp(bia)).toBe(before + 23);
  });

  it("empurrão só com mensagens prontas", async () => {
    await expect(callAs(c, bia, "select public.send_boost($1, 'empurrao', 'oi feio')", [ana])).rejects.toThrow(/message_invalid/);
    await one(bia, "select public.send_boost($1, 'empurrao', 'Bora estudar! 📚') r", [ana]);
    const ov = await one(ana, "select public.social_overview() r");
    expect(ov.boosts[0]).toMatchObject({ kind: "empurrao", message: "Bora estudar! 📚" });
  });
});

describe("tripulações e mural", () => {
  it("criar, entrar pelo código, ver ranking e mural; quem não é membro não vê", async () => {
    const id = await one(ana, "select public.crew_create('Piratas do ENEM', '🏴‍☠️') r");
    const code = (await c.query("select invite_code from crews where id = $1", [id])).rows[0].invite_code;
    expect(await one(bia, "select public.crew_join($1) r", [code.toLowerCase()])).toBe(id);
    const d = await one(ana, "select public.crew_detail($1) r", [id]);
    expect(d.members.map((m: any) => m.username)).toEqual(["bia_vest", "ana.estuda"]);
    expect(d.feed.some((e: any) => e.kind === "tripulacao")).toBe(true);
    await expect(callAs(c, dani, "select public.crew_detail($1)", [id])).rejects.toThrow(/not_found/);
    // colegas de tripulação podem mandar boost mesmo sem serem amigos (Bia e Caio não são)
    await one(caio, "select public.crew_join($1) r", [code]);
    await one(caio, "select public.send_boost($1, 'empurrao', 'Você consegue! 💪') r", [bia]);
  });

  it("reagir no mural só de amigos/tripulação; reagir de novo desfaz", async () => {
    const ev = (await c.query("select id from activity_events where user_id = $1 limit 1", [bia])).rows[0].id;
    expect(await one(ana, "select public.react($1, '🔥') r", [ev])).toEqual({ "🔥": 1 });
    expect(await one(ana, "select public.react($1, '🔥') r", [ev])).toEqual({});
    await expect(callAs(c, dani, "select public.react($1, '🔥')", [ev])).rejects.toThrow(/not_allowed/);
  });

  it("tripulação tem no máximo 12", async () => {
    const id = await one(dani, "select public.crew_create('Cheia', '⚓') r");
    const code = (await c.query("select invite_code from crews where id = $1", [id])).rows[0].invite_code;
    for (let i = 0; i < 11; i++) await one(await createUser(c, `m${i}@x.com`), "select public.crew_join($1) r", [code]);
    await expect(callAs(c, await createUser(c, "extra@x.com"), "select public.crew_join($1)", [code])).rejects.toThrow(/crew_full/);
  });
});

describe("ligas semanais", () => {
  it("entra na divisão inicial ao ganhar o primeiro XP da semana", async () => {
    const r = await c.query("select tier, grp from league_members where user_id = $1 and week = public._week_start()", [ana]);
    expect(r.rows[0]).toMatchObject({ tier: 0, grp: 1 });
    const ov = await one(ana, "select public.social_overview() r");
    expect(ov.league.members.length).toBeGreaterThanOrEqual(3);
  });

  it("top 7 da semana anterior sobe de divisão; quem fez 0 XP desce", async () => {
    const eva = await createUser(c, "eva@x.com");
    const fred = await createUser(c, "fred@x.com");
    const prev = "public._week_start() - interval '7 days'";
    await c.query(`insert into league_members (week, user_id, tier, grp) values (${prev}, $1, 2, 9), (${prev}, $2, 2, 9)`, [eva, fred]);
    await c.query(`insert into xp_events (user_id, source, xp, ref, at, day) values ($1, 'bonus', 300, 'semana-passada', ${prev} + interval '1 day', current_date - 7)`, [eva]);
    await answer(eva, ["s50"], true);
    await answer(fred, ["s51"], true);
    const t = async (u: string) => (await c.query("select tier, moved from league_members where user_id = $1 and week = public._week_start()", [u])).rows[0];
    expect(await t(eva)).toEqual({ tier: 3, moved: 1 });
    expect(await t(fred)).toEqual({ tier: 1, moved: -1 });
    expect((await c.query("select kind from activity_events where user_id = $1", [eva])).rows.map((r) => r.kind)).toContain("liga");
  });
});
