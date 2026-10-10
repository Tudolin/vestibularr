"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { newInviteToken } from "@/lib/invites";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createInviteSchema,
  createStudentSchema,
  resetPasswordSchema,
  setActiveSchema,
  updateStudentSchema,
  type ActionResult,
} from "@/lib/validation";

const fail = (error: string, fieldErrors?: Record<string, string[] | undefined>): ActionResult => ({
  ok: false,
  error,
  fieldErrors,
});

/** Toda action revalida o papel no servidor: o cliente nunca é confiável. */
export async function createStudentAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = createStudentSchema.safeParse(input);
  if (!parsed.success) return fail("Confira os campos.", parsed.error.flatten().fieldErrors);

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error || !data.user) {
    return fail(/already|registered/i.test(error?.message ?? "") ? "Este e-mail já está cadastrado." : "Não foi possível criar o aluno.");
  }
  // O trigger já criou o perfil como 'student' (com trial); garante o nome e coloca na Família do admin.
  await admin.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", data.user.id);
  await admin.from("subscriptions").upsert({ user_id: data.user.id, plan_code: "familia", status: "active", trial_end: null, provider: "manual" });
  revalidatePath("/admin/alunos");
  return { ok: true };
}

export async function updateStudentAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updateStudentSchema.safeParse(input);
  if (!parsed.success) return fail("Confira os campos.", parsed.error.flatten().fieldErrors);
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", parsed.data.id);
  if (error) return fail("Não foi possível salvar.");
  revalidatePath("/admin/alunos");
  return { ok: true };
}

export async function setActiveAction(input: unknown): Promise<ActionResult> {
  const me = await requireAdmin();
  const parsed = setActiveSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  if (parsed.data.id === me.id) return fail("Você não pode desativar a própria conta.");
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ is_active: parsed.data.isActive }).eq("id", parsed.data.id);
  if (error) return fail("Não foi possível atualizar.");
  if (!parsed.data.isActive) {
    // Derruba as sessões abertas do usuário desativado.
    await admin.auth.admin.signOut(parsed.data.id, "global").catch(() => {});
  }
  revalidatePath("/admin/alunos");
  return { ok: true };
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("Confira os campos.", parsed.error.flatten().fieldErrors);
  const { error } = await createAdminClient().auth.admin.updateUserById(parsed.data.id, {
    password: parsed.data.password,
  });
  if (error) return fail("Não foi possível redefinir a senha.");
  return { ok: true };
}

/**
 * Cria um convite de uso único. Devolve o token UMA vez (o banco guarda só o hash);
 * o cliente monta o link com a própria origem: <origem>/convite/<token>.
 */
export async function createInviteAction(input: unknown): Promise<ActionResult<{ token: string }>> {
  const me = await requireAdmin();
  const parsed = createInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira os campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { token, hash } = newInviteToken();
  const { error } = await (await createClient()).from("invites").insert({
    token_hash: hash,
    role: parsed.data.role,
    email: parsed.data.email ?? null,
    note: parsed.data.note ?? null,
    created_by: me.id,
    expires_at: new Date(Date.now() + parsed.data.days * 86_400_000).toISOString(),
  });
  if (error) return fail("Não foi possível criar o convite.") as ActionResult<{ token: string }>;
  revalidatePath("/admin/alunos");
  return { ok: true, data: { token } };
}

export async function revokeInviteAction(id: unknown): Promise<ActionResult> {
  await requireAdmin();
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return fail("Convite inválido.");
  const { error } = await (await createClient())
    .from("invites").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("used_at", null);
  if (error) return fail("Não foi possível revogar.");
  revalidatePath("/admin/alunos");
  return { ok: true };
}

/** Beta: liga/desliga "todos os alunos com acesso do plano Pro" (desligar quando o pagamento entrar). */
export async function setBetaAction(on: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (typeof on !== "boolean") return fail("Valor inválido.");
  const { error } = await (await createClient()).from("settings").update({ value: on }).eq("key", "beta_open_access");
  if (error) return fail("Não foi possível salvar (aplicou a migration 0017?).");
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
