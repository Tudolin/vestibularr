import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { hashInviteToken, inviteStatus, isInviteTokenShape } from "@/lib/invites";
import { createAdminClient } from "@/lib/supabase/admin";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Convite", robots: { index: false, follow: false } };

const MSG = {
  invalido: "Este link de convite não existe. Confira se copiou o endereço inteiro.",
  usado: "Este convite já foi usado. Cada link vale para um único cadastro.",
  expirado: "Este convite expirou. Peça um novo link ao administrador.",
  revogado: "Este convite foi cancelado pelo administrador.",
} as const;

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let problem: keyof typeof MSG | null = "invalido";
  let invite: { role: "student" | "admin"; email: string | null; note: string | null } | null = null;
  if (isInviteTokenShape(token)) {
    const { data } = await createAdminClient()
      .from("invites").select("role, email, note, used_at, revoked_at, expires_at").eq("token_hash", hashInviteToken(token)).maybeSingle();
    if (data) {
      const st = inviteStatus(data);
      problem = st === "pendente" ? null : st;
      invite = { role: data.role, email: data.email, note: data.note };
    }
  }

  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <GraduationCap className="size-8" aria-hidden />
        </span>
        <h1 className="text-3xl font-extrabold">Vestibularr</h1>
        {!problem && invite && (
          <p className="text-muted-foreground">
            Você foi convidado{invite.note ? ` (${invite.note})` : ""} para criar sua conta
            {invite.role === "admin" ? " de administrador" : " de aluno"}.
          </p>
        )}
      </div>
      {problem ? (
        <div className="flex flex-col gap-4">
          <p role="alert" className="rounded-control bg-warning-soft px-4 py-3 text-sm font-medium text-warning-soft-foreground">{MSG[problem]}</p>
          <Button asChild variant="outline"><Link href="/login">Ir para o login</Link></Button>
        </div>
      ) : (
        <InviteForm token={token} lockedEmail={invite?.email ?? null} />
      )}
    </main>
  );
}
