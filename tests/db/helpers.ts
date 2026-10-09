import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:54329/vestibularr_test";

const root = join(__dirname, "../../supabase");

/**
 * Recria o banco do zero: shim do Supabase + todas as migrations em ordem.
 * Os dados de teste não têm resolução; por isso o filtro "só questões com solução" vem desligado,
 * exceto quando o teste pede `onlySolved: true`.
 */
export async function resetDb(admin: Client, opts: { onlySolved?: boolean } = {}) {
  await admin.query("drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;");
  await admin.query(readFileSync(join(root, "tests/shim.sql"), "utf8"));
  const files = readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) await admin.query(readFileSync(join(root, "migrations", f), "utf8"));
  if (!opts.onlySolved) await admin.query("update public.settings set value = 'false' where key = 'only_solved_questions'");
}

export async function connect() {
  const c = new Client({ connectionString: TEST_DB_URL });
  await c.connect();
  return c;
}

/** Executa `fn` numa transação como o usuário (role authenticated + sub do JWT) e faz rollback. */
export async function asUser<T>(
  c: Client,
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await c.query("begin");
  try {
    await c.query(`set local role ${userId ? "authenticated" : "anon"}`);
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    return await fn();
  } finally {
    await c.query("rollback");
  }
}

export async function createUser(c: Client, email: string, role: "admin" | "student" = "student", active = true) {
  const { rows } = await c.query("insert into auth.users (email) values ($1) returning id", [email]);
  const id = rows[0].id as string;
  await c.query("update public.profiles set role = $2, is_active = $3 where id = $1", [id, role, active]);
  return id;
}

/** Executa como o usuário e CONFIRMA (commit): para RPCs que gravam e são lidas depois. */
export async function callAs<T = unknown>(c: Client, userId: string, sql: string, params: unknown[] = []): Promise<T> {
  await c.query("begin");
  try {
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    const r = await c.query(sql, params);
    await c.query("commit");
    return r.rows as T;
  } catch (e) {
    await c.query("rollback");
    throw e;
  }
}

/** Importa um bundle como service-role (igual ao seed). */
export async function seedBundle(c: Client, bundle: unknown) {
  await c.query("begin");
  await c.query("set local role service_role");
  await c.query(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
  const r = await c.query("select public.import_bundle($1::jsonb) as r", [JSON.stringify(bundle)]);
  await c.query("commit");
  return r.rows[0].r;
}
