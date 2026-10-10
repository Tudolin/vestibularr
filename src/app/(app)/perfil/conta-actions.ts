"use server";

import { createClient as createPlainClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

/** Confere a senha atual sem mexer na sessão do navegador (cliente separado, sem cookies). */
async function passwordOk(email: string, password: string) {
  const env = publicEnv();
  const c = createPlainClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (!error) await c.auth.signOut({ scope: "local" }).catch(() => {});
  return !error;
}

export async function updateNameAction(name: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const p = z.string().trim().min(2, "Nome muito curto.").max(80).safeParse(name);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { error } = await (await createClient()).from("profiles").update({ full_name: p.data }).eq("id", user.id);
  if (error) return { ok: false, error: "Não foi possível salvar." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const p = z.object({ current: z.string().min(1), next: z.string().min(8, "A nova senha precisa de pelo menos 8 caracteres.").max(72) }).safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  if (!user.email || !(await passwordOk(user.email, p.data.current))) return { ok: false, error: "Senha atual incorreta." };
  const { error } = await (await createClient()).auth.updateUser({ password: p.data.next });
  return error ? { ok: false, error: "Não foi possível trocar a senha agora." } : { ok: true };
}

export async function changeEmailAction(email: unknown): Promise<ActionResult> {
  await requireUser();
  const p = z.email("E-mail inválido.").safeParse(String(email ?? "").trim().toLowerCase());
  if (!p.success) return { ok: false, error: "E-mail inválido." };
  const { error } = await (await createClient()).auth.updateUser({ email: p.data }, { emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/perfil` });
  if (error) return { ok: false, error: /already|registered|exists/i.test(error.message) ? "Esse e-mail já está em uso." : "Não foi possível trocar o e-mail agora." };
  return { ok: true };
}

/** Encerra a sessão em todos os aparelhos (celular perdido, computador emprestado…). */
export async function signOutEverywhereAction() {
  await requireUser();
  await (await createClient()).auth.signOut({ scope: "global" });
  redirect("/login?saiu=todos");
}

/** Exclusão da conta (LGPD e regra das lojas): confirma a senha, apaga o usuário e tudo que é dele (cascata). */
export async function deleteAccountAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const p = z.object({ password: z.string().min(1), confirm: z.literal("EXCLUIR") }).safeParse(input);
  if (!p.success) return { ok: false, error: 'Digite EXCLUIR e sua senha para confirmar.' };
  if (user.role === "admin") return { ok: false, error: "Contas de administrador não podem ser excluídas por aqui. Peça a outro admin." };
  if (!user.email || !(await passwordOk(user.email, p.data.password))) return { ok: false, error: "Senha incorreta." };
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: "Não foi possível excluir agora. Tente de novo." };
  await (await createClient()).auth.signOut({ scope: "local" }).catch(() => {});
  redirect("/?conta=excluida");
}
