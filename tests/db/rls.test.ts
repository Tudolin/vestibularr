import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, connect, createUser, resetDb } from "./helpers";

let c: Client;
let admin: string, alice: string, bob: string, inactive: string;

beforeAll(async () => {
  c = await connect();
  await resetDb(c);
  admin = await createUser(c, "admin@x.com", "admin");
  alice = await createUser(c, "alice@x.com");
  bob = await createUser(c, "bob@x.com");
  inactive = await createUser(c, "off@x.com", "student", false);
});
afterAll(() => c.end());

const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

describe("profiles", () => {
  it("trigger cria perfil como aluno ativo", async () => {
    const { rows } = await c.query("select role, is_active from public.profiles where id = $1", [alice]);
    expect(rows[0]).toEqual({ role: "student", is_active: true });
  });

  it("aluno vê só o próprio perfil", async () => {
    const rows = await asUser(c, alice, async () => (await c.query("select id from public.profiles")).rows);
    expect(ids(rows)).toEqual([alice]);
  });

  it("admin vê todos os perfis", async () => {
    const rows = await asUser(c, admin, async () => (await c.query("select id from public.profiles")).rows);
    expect(ids(rows)).toEqual(ids([{ id: admin }, { id: alice }, { id: bob }, { id: inactive }]));
  });

  it("anon não lê nada", async () => {
    await expect(asUser(c, null, () => c.query("select * from public.profiles"))).rejects.toThrow();
  });

  it("aluno não consegue virar admin nem se reativar", async () => {
    await expect(
      asUser(c, alice, () => c.query("update public.profiles set role = 'admin' where id = $1", [alice])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(c, inactive, () => c.query("update public.profiles set is_active = true where id = $1", [inactive])),
    ).rejects.toThrow(/permission denied/);
  });

  it("aluno edita o próprio nome mas não o de outro", async () => {
    const own = await asUser(c, alice, () => c.query("update public.profiles set full_name = 'Alice' where id = $1", [alice]));
    expect(own.rowCount).toBe(1);
    const other = await asUser(c, alice, () => c.query("update public.profiles set full_name = 'x' where id = $1", [bob]));
    expect(other.rowCount).toBe(0);
  });

  it("aluno desativado não edita nem lê configurações", async () => {
    const upd = await asUser(c, inactive, () => c.query("update public.profiles set full_name = 'x' where id = $1", [inactive]));
    expect(upd.rowCount).toBe(0);
    const s = await asUser(c, inactive, async () => (await c.query("select * from public.settings")).rows);
    expect(s).toHaveLength(0);
  });
});

describe("conteúdo e configurações", () => {
  it("aluno lê vestibulares e formatos, mas não escreve", async () => {
    const boards = await asUser(c, alice, async () => (await c.query("select code from public.exam_boards")).rows);
    expect(boards.map((b) => b.code).sort()).toEqual(["ENEM", "UFPR"]);
    await expect(
      asUser(c, alice, () => c.query("insert into public.exam_boards (code, name) values ('X','X')")),
    ).rejects.toThrow(/row-level security/);
    const upd = await asUser(c, alice, () => c.query("update public.settings set value = '999' where key = 'ai_daily_limit_per_student'"));
    expect(upd.rowCount).toBe(0);
  });

  it("admin escreve configurações", async () => {
    const upd = await asUser(c, admin, () => c.query("update public.settings set value = '7' where key = 'ai_daily_limit_per_student'"));
    expect(upd.rowCount).toBe(1);
  });

  it("formato UFPR 2027 reflete o edital", async () => {
    const { rows } = await c.query("select structure from public.exam_formats where code = 'UFPR_fase_unica_2027'");
    const s = rows[0].structure;
    expect(s.duration_minutes).toBe(330);
    expect(s.alternatives).toBe(4);
    const total = Object.values(s.sections[0].subjects as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(total).toBe(80);
    expect(s.sections[1].questions.map((q: { max_score: number }) => q.max_score)).toEqual([25, 15]);
  });
});

describe("access_logs", () => {
  it("aluno registra o próprio acesso, não de outro", async () => {
    const ok = await asUser(c, alice, () => c.query("insert into public.access_logs (user_id, event, path) values ($1,'page','/inicio')", [alice]));
    expect(ok.rowCount).toBe(1);
    await expect(
      asUser(c, alice, () => c.query("insert into public.access_logs (user_id, event) values ($1,'login')", [bob])),
    ).rejects.toThrow(/row-level security/);
  });

  it("só o admin lê logs", async () => {
    await c.query("insert into public.access_logs (user_id, event) values ($1,'login')", [alice]);
    const asStudent = await asUser(c, alice, async () => (await c.query("select * from public.access_logs")).rows);
    expect(asStudent).toHaveLength(0);
    const asAdmin = await asUser(c, admin, async () => (await c.query("select * from public.access_logs")).rows);
    expect(asAdmin.length).toBeGreaterThan(0);
  });
});
