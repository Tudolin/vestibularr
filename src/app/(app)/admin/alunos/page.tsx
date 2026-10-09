import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inviteStatus } from "@/lib/invites";
import { InvitesManager, type InviteRow } from "./invites-manager";
import { StudentsManager, type StudentRow } from "./students-manager";

export const metadata: Metadata = { title: "Alunos" };

type DbInvite = { id: string; role: "student" | "admin"; email: string | null; note: string | null; created_at: string; expires_at: string; used_at: string | null; revoked_at: string | null; used_by: string | null };

/** Pendentes + o que aconteceu nos últimos 30 dias. */
function toInviteRows(list: DbInvite[], names: Map<string, string | null>, now = Date.now()): InviteRow[] {
  const since = new Date(now - 30 * 86_400_000).toISOString();
  return list
    .map((i) => ({ i, status: inviteStatus(i, now) }))
    .filter(({ i, status }) => status === "pendente" || i.created_at >= since)
    .map(({ i, status }) => ({
      id: i.id, role: i.role, email: i.email, note: i.note, status,
      createdAt: i.created_at, expiresAt: i.expires_at, usedBy: i.used_by ? (names.get(i.used_by) ?? null) : null,
    }));
}

export default async function AlunosPage() {
  const me = await requireAdmin();
  const supabase = await createClient(); // RLS: admin enxerga todos os perfis
  const [{ data }, { data: inv }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, is_active, last_seen_at, created_at").order("created_at", { ascending: true }),
    supabase.from("invites").select("id, role, email, note, created_at, expires_at, used_at, revoked_at, used_by").order("created_at", { ascending: false }).limit(50),
  ]);
  const names = new Map((data ?? []).map((p) => [p.id, p.full_name || p.email]));
  const invites = toInviteRows(inv ?? [], names);

  const rows: StudentRow[] = (data ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    role: p.role,
    isActive: p.is_active,
    lastSeenAt: p.last_seen_at,
    isMe: p.id === me.id,
  }));
  return (
    <div className="flex flex-col gap-8">
      <StudentsManager rows={rows} />
      <InvitesManager rows={invites} />
    </div>
  );
}
