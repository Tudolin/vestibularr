import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, connect, createUser, resetDb } from "./helpers";

let c: Client;
let admin: string, alice: string;
const hash = (ch: string) => ch.repeat(64);
const future = () => new Date(Date.now() + 86_400_000).toISOString();

beforeAll(async () => {
  c = await connect();
  await resetDb(c);
  admin = await createUser(c, "admin@x.com", "admin");
  alice = await createUser(c, "alice@x.com");
});
afterAll(() => c.end());

describe("convites", () => {
  it("só admin cria e lista convites, sempre em nome próprio", async () => {
    await asUser(c, admin, async () => {
      await c.query("insert into invites (token_hash, role, created_by, expires_at) values ($1, 'student', $2, $3)", [hash("a"), admin, future()]);
      expect((await c.query("select count(*)::int n from invites")).rows[0].n).toBe(1);
      await expect(c.query("insert into invites (token_hash, role, created_by, expires_at) values ($1, 'admin', $2, $3)", [hash("b"), alice, future()]))
        .rejects.toThrow(/row-level security/);
    });
  });

  it("aluno não lê nem cria convites (nem para virar admin)", async () => {
    await c.query("insert into invites (token_hash, role, created_by, expires_at) values ($1, 'admin', $2, $3)", [hash("c"), admin, future()]);
    await asUser(c, alice, async () => {
      expect((await c.query("select count(*)::int n from invites")).rows[0].n).toBe(0);
      const r = await c.query("update invites set revoked_at = now()");
      expect(r.rowCount).toBe(0);
      await expect(c.query("insert into invites (token_hash, role, created_by, expires_at) values ($1, 'admin', $2, $3)", [hash("d"), alice, future()]))
        .rejects.toThrow(/row-level security/);
    });
  });

  it("guarda só hash válido e e-mail em minúsculas", async () => {
    await expect(c.query("insert into invites (token_hash, created_by, expires_at) values ('token-cru', $1, $2)", [admin, future()])).rejects.toThrow(/check/);
    await expect(c.query("insert into invites (token_hash, email, created_by, expires_at) values ($1, 'Ana@X.com', $2, $3)", [hash("e"), admin, future()])).rejects.toThrow(/check/);
  });
});
