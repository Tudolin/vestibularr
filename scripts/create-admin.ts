/**
 * Cria (ou promove) o primeiro administrador. Uso:
 *   npx tsx --env-file=.env.local scripts/create-admin.ts email@exemplo.com "Seu Nome" "senha-forte"
 * Roda localmente com a service-role; nunca exponha essa chave ao navegador.
 */
import { createClient } from "@supabase/supabase-js";

const [email, fullName, password] = process.argv.slice(2);
if (!email || !fullName || !password) {
  console.error('Uso: create-admin.ts <email> "<nome>" "<senha (mín. 8)>"');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ex.: .env.local).");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

let userId: string | undefined;
const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});
if (created.error) {
  if (!/already|registered/i.test(created.error.message)) throw created.error;
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  userId = data.users.find((u) => u.email === email)?.id;
  if (!userId) throw new Error("Usuário existe mas não foi encontrado.");
  console.log("Usuário já existia; promovendo a admin.");
} else {
  userId = created.data.user.id;
}

const { error } = await admin
  .from("profiles")
  .update({ role: "admin", is_active: true, full_name: fullName })
  .eq("id", userId);
if (error) throw error;
console.log(`✔ ${email} agora é administrador.`);
