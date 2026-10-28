"use server";

import { headers } from "next/headers";
import { RECOVERY_PATH } from "@/lib/recovery";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { verifyTurnstile } from "@/lib/turnstile";
import { forgotPasswordSchema, type ActionResult } from "@/lib/validation";

/**
 * Pede o e-mail de redefinição de senha. Por segurança, a resposta é a mesma com ou sem conta
 * (não revelamos quem está cadastrado); só avisamos quando o Supabase limita as tentativas.
 */
export async function forgotPasswordAction(_prev: ActionResult<{ email: string }> | null, formData: FormData): Promise<ActionResult<{ email: string }>> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, error: "Confira o e-mail.", fieldErrors: parsed.error.flatten().fieldErrors };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!(await verifyTurnstile(formData.get("cf-turnstile-response") as string | null, ip))) {
    return { ok: false, error: "Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo." };
  }

  const { error } = await (await createClient()).auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=${RECOVERY_PATH}`,
  });
  if (error && /rate|too many|security purposes/i.test(error.message)) {
    return { ok: false, error: "Muitos pedidos seguidos. Espere alguns minutos e tente de novo." };
  }
  return { ok: true, data: { email: parsed.data.email } };
}
