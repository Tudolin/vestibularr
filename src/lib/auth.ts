import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "student";
export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string;
  role: Role;
  preferences: Record<string, unknown>;
};

/**
 * Data Access Layer: a autorização real mora aqui (e na RLS), não no proxy.
 * `getUser()` consulta o Auth server; o perfil vem via RLS (só o próprio).
 * Usuário desativado é tratado como deslogado.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, is_active, preferences")
    .eq("id", data.user.id)
    .single();
  if (!profile || !profile.is_active) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    fullName: profile.full_name,
    role: profile.role,
    preferences: (profile.preferences ?? {}) as Record<string, unknown>,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?erro=sessao");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/inicio");
  return user;
}
