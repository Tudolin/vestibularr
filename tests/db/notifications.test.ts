import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { callAs, connect, createUser, resetDb } from "./helpers";

let c: Client;
let ana: string, bia: string, caio: string;

beforeAll(async () => {
  c = await connect();
  await resetDb(c);
  ana = await createUser(c, "ana@x.com");
  bia = await createUser(c, "bia@x.com");
  caio = await createUser(c, "caio@x.com");
});
afterAll(() => c.end());

const due = async (hour: number) => {
  await c.query("set role service_role");
  try { return (await c.query("select user_id from public.reminders_due($1)", [hour])).rows.map((r) => r.user_id as string); }
  finally { await c.query("reset role"); }
};
const sub = (u: string, endpoint: string) => callAs(c, u, "select public.push_subscribe($1, 'p256dh-chave-teste', 'auth-teste', 'ua')", [endpoint]);

describe("push e lembretes", () => {
  it("inscrição do aparelho: só https, e o mesmo aparelho passa para quem entrou por último", async () => {
    await expect(sub(ana, "http://inseguro")).rejects.toThrow(/endpoint/);
    await sub(ana, "https://push.example/1");
    await sub(bia, "https://push.example/1"); // Bia entrou no mesmo celular
    const rows = (await c.query("select user_id from push_subscriptions")).rows;
    expect(rows).toEqual([{ user_id: bia }]);
    await sub(ana, "https://push.example/2");
  });

  it("lembrete: respeita o horário, quem já estudou hoje e quem já foi avisado", async () => {
    // Caio não tem aparelho nem e-mail ligado: não entra
    expect(await due(18)).toEqual([]); // padrão 19h
    expect((await due(19)).sort()).toEqual([ana, bia].sort());
    await c.query(`update profiles set preferences = preferences || '{"notifications": {"hour": 8}}' where id = $1`, [ana]);
    expect(await due(9)).toEqual([ana]);
    await c.query("insert into xp_events (user_id, source, xp, ref) values ($1, 'bonus', 10, 'x')", [bia]); // Bia estudou
    expect(await due(20)).toEqual([ana]);
    await c.query("insert into notification_log (user_id, kind) values ($1, 'lembrete')", [ana]);
    expect(await due(20)).toEqual([]);
    await c.query(`update profiles set preferences = preferences || '{"notifications": {"email": true}}' where id = $1`, [caio]);
    expect(await due(20)).toEqual([caio]); // só e-mail também vale
  });

  it("alunos não chamam as funções do cron", async () => {
    await expect(callAs(c, ana, "select * from public.reminders_due(20)")).rejects.toThrow(/permission denied/);
  });
});
