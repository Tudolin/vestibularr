import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:54329/vestibularr_test";

const root = join(__dirname, "../../supabase");

/** Recria o banco do zero: shim do Supabase + todas as migrations em ordem. */
export async function resetDb(admin: Client) {
  await admin.query("drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;");
  await admin.query(readFileSync(join(root, "tests/shim.sql"), "utf8"));
  const files = readdirSync(join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) await admin.query(readFileSync(join(root, "migrations", f), "utf8"));
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
