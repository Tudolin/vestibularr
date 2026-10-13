import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, callAs, connect, createUser, resetDb } from "./helpers";

let c: Client;
let ana: string, bia: string, adm: string;

beforeAll(async () => {
  c = await connect();
  await resetDb(c);
  ana = await createUser(c, "ana@x.com");
  bia = await createUser(c, "bia@x.com");
  adm = await createUser(c, "adm@x.com", "admin");
});
afterAll(() => c.end());

const send = (u: string, p: Record<string, unknown>) =>
  callAs<{ id: string; status: string; reply: string | null }[]>(c, u,
    "insert into feedback (user_id, kind, message, rating, page, status, reply) values ($1, $2, $3, $4, $5, $6, $7) returning id, status, reply",
    [u, p.kind ?? "elogio", p.message ?? "Gostei muito do app", p.rating ?? null, p.page ?? "/inicio", p.status ?? "novo", p.reply ?? null]).then((r) => r[0]);

describe("feedback", () => {
  it("aluno envia e vê só os próprios; não marca como resolvido nem responde a si mesmo", async () => {
    const f = await send(ana, { kind: "problema", message: "O botão some no celular", status: "resolvido", reply: "ok" });
    expect(f).toMatchObject({ status: "novo", reply: null });
    await send(bia, { kind: "ideia", message: "Modo noturno no simulado" });
    const mine = await asUser(c, ana, async () => (await c.query("select kind from feedback")).rows);
    expect(mine).toEqual([{ kind: "problema" }]);
    await expect(send(ana, { kind: "spam" })).rejects.toThrow(/feedback_kind_check/);
    await expect(send(ana, { message: "a" })).rejects.toThrow(/feedback_message_check/);
    await expect(asUser(c, ana, () => c.query("insert into feedback (user_id, kind, message) values ($1, 'elogio', 'oi oi oi')", [bia]))).rejects.toThrow(/row-level security/);
  });

  it("aluno não altera; admin vê todos, responde e muda o status", async () => {
    const upd = await asUser(c, ana, async () => (await c.query("update feedback set status = 'resolvido' returning id")).rowCount);
    expect(upd).toBe(0);
    const all = await asUser(c, adm, async () => (await c.query("select id from feedback")).rows);
    expect(all).toHaveLength(2);
    const [r] = await callAs<{ status: string; replied_at: Date | null }[]>(c, adm,
      "update feedback set status = 'resolvido', reply = 'Arrumado, valeu!' where user_id = $1 returning status, replied_at", [ana]);
    expect(r.status).toBe("resolvido");
    expect(r.replied_at).not.toBeNull();
    const seen = await asUser(c, ana, async () => (await c.query("select reply from feedback")).rows[0]);
    expect(seen.reply).toBe("Arrumado, valeu!");
  });

  it("limite de 20 por dia", async () => {
    for (let i = 0; i < 19; i++) await send(bia, { message: `ideia número ${i}` });
    await expect(send(bia, { message: "mais uma ideia" })).rejects.toThrow(/feedback_limit/);
  });
});
