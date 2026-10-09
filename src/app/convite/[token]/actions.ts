"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hashInviteToken } from "@/lib/invites";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redeemInviteSchema, type ActionResult } from "@/lib/validation";

/**
 * Resgata um convite: (1) confere o e-mail travado e reserva o convite com UPDATE condicional atômico
 * (não usado, não revogado, não expirado), (2) cria a conta, (3) ajusta perfil/papel, (4) entra. Se a criação falhar, libera o convite.
 * A service-role é usada aqui porque a pessoa ainda não tem conta; o token (256 bits) é a autorização.
 */
export async function redeemInviteAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = redeemInviteSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { ok: false, error: "Confira os campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  const { token, fullName, email, password } = parsed.data;

  const admin = createAdminClient();
  const invalid: ActionResult = { ok: false, error: "Este convite não é mais válido (já usado, expirado ou revogado)." };
  const { data: invite } = await admin.from("invites").select("id, role, email").eq("token_hash", hashInviteToken(token)).maybeSingle();
  if (!invite) return invalid;
  if (invite.email && invite.email !== email) {
    return { ok: false, error: "Este convite é para outro e-mail.", fieldErrors: { email: ["Use o e-mail do convite"] } };
  }
  // Reserva atômica: só um cadastro consegue marcar o convite como usado.
  const now = new Date().toISOString();
  const { data: claimed } = await admin
    .from("invites")
    .update({ used_at: now })
    .eq("id", invite.id)
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .select("id, role")
    .maybeSingle();
  if (!claimed) return invalid;

  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (error || !created.user) {
    await admin.from("invites").update({ used_at: null }).eq("id", claimed.id);
    return /already|registered|exists/i.test(error?.message ?? "")
      ? { ok: false, error: "Este e-mail já tem conta. Entre pela tela de login.", fieldErrors: { email: ["E-mail já cadastrado"] } }
      : { ok: false, error: "Não foi possível criar a conta. Tente de novo." };
  }

  // O trigger cria o perfil sempre como 'student'; o papel de admin só vem do convite, aqui no servidor.
  await admin.from("profiles").update({ full_name: fullName, ...(claimed.role === "admin" ? { role: "admin" } : {}) }).eq("id", created.user.id);
  await admin.from("invites").update({ used_by: created.user.id }).eq("id", claimed.id);

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) redirect("/login");
  const ua = (await headers()).get("user-agent") ?? "";
  await supabase.from("access_logs").insert({
    user_id: created.user.id, event: "login", device: /iphone|ipad|android|mobile/i.test(ua) ? "mobile" : "desktop", user_agent: ua.slice(0, 300),
  });
  redirect(claimed.role === "admin" ? "/admin" : "/inicio");
}
