"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
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
  // O trigger já criou o perfil como 'student'; garante o nome.
  await admin.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", data.user.id);
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
