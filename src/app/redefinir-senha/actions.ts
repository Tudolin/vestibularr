"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RECOVERY_COOKIE } from "@/lib/recovery";
import { createClient } from "@/lib/supabase/server";
import { newPasswordSchema, type ActionResult } from "@/lib/validation";

/** Senha nova pelo link do e-mail: sem pedir a atual, mas só com o cookie que o link marcou. */
export async function newPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { ok: false, error: "Confira os campos.", fieldErrors: parsed.error.flatten().fieldErrors };

  const store = await cookies();
  if (store.get(RECOVERY_COOKIE)?.value !== "1") return { ok: false, error: "O link expirou. Peça um novo em \"Esqueci minha senha\"." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "O link expirou. Peça um novo em \"Esqueci minha senha\"." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (/different|same/i.test(error.message)) return { ok: false, error: "Escolha uma senha diferente da anterior.", fieldErrors: { password: ["Use uma senha diferente da anterior"] } };
    if (/weak|password/i.test(error.message)) return { ok: false, error: "Escolha uma senha mais forte.", fieldErrors: { password: ["Senha fraca: misture letras, números e símbolos"] } };
    return { ok: false, error: "Não foi possível trocar a senha agora. Tente de novo." };
  }
  store.delete(RECOVERY_COOKIE);
  // Quem pediu a senha nova pode ter perdido o controle da conta: derruba as outras sessões.
  await supabase.auth.signOut({ scope: "others" });
  redirect("/inicio");
}
