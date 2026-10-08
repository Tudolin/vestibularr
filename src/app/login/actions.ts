"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, type ActionResult } from "@/lib/validation";

function deviceFrom(ua: string) {
  if (/iphone|ipad|android|mobile/i.test(ua)) return "mobile";
  return "desktop";
}

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Confira os campos.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { ok: false, error: "E-mail ou senha incorretos." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .single();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { ok: false, error: "Conta desativada. Fale com o administrador." };
  }

  const ua = (await headers()).get("user-agent") ?? "";
  await supabase.from("access_logs").insert({
    user_id: data.user.id,
    event: "login",
    device: deviceFrom(ua),
    user_agent: ua.slice(0, 300),
  });
  await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", data.user.id);

  const next = String(formData.get("next") ?? "");
  // Evita open redirect: só caminhos internos.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/inicio");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
