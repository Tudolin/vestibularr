import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StudentsManager, type StudentRow } from "./students-manager";

export const metadata: Metadata = { title: "Alunos" };

export default async function AlunosPage() {
  const me = await requireAdmin();
  const supabase = await createClient(); // RLS: admin enxerga todos os perfis
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active, last_seen_at, created_at")
    .order("created_at", { ascending: true });

  const rows: StudentRow[] = (data ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    role: p.role,
    isActive: p.is_active,
    lastSeenAt: p.last_seen_at,
    isMe: p.id === me.id,
  }));
  return <StudentsManager rows={rows} />;
}
