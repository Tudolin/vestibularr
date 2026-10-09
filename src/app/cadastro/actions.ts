"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import { signUpSchema, type ActionResult } from "@/lib/validation";

/**
 * Cadastro público ("Comece grátis"). A conta nasce com 7 dias de Pro (trigger no banco).
 * Com confirmação de e-mail ligada no Supabase, devolve "confira seu e-mail"; sem ela, já entra.
 * Por segurança, e-mail já cadastrado recebe a mesma resposta (não revelamos quem tem conta).
 */
export async function signUpAction(_prev: ActionResult<{ email: string }> | null, formData: FormData): Promise<ActionResult<{ email: string }>> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    terms: formData.get("terms") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: "Confira os campos.", fieldErrors: parsed.error.flatten().fieldErrors };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response") as string | null, ip))) {
    return { ok: false, error: "Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/onboarding`,
      data: { full_name: parsed.data.fullName, terms_accepted_at: new Date().toISOString() },
    },
  });
  if (error) {
    if (/rate|too many/i.test(error.message)) return { ok: false, error: "Muitas tentativas. Espere alguns minutos e tente de novo." };
    if (/password/i.test(error.message)) return { ok: false, error: "Escolha uma senha mais forte.", fieldErrors: { password: ["Senha fraca: misture letras, números e símbolos"] } };
    return { ok: false, error: "Não foi possível criar a conta agora. Tente de novo." };
  }
  if (data.session) redirect("/onboarding");
  return { ok: true, data: { email: parsed.data.email } };
}
