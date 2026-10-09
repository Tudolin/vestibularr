"use client";

import { Check, Copy, Link2, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FieldError, Input, Label } from "@/components/ui/input";
import type { InviteStatus } from "@/lib/invites";
import type { ActionResult } from "@/lib/validation";
import { createInviteAction, revokeInviteAction } from "./actions";

export type InviteRow = {
  id: string;
  role: "student" | "admin";
  email: string | null;
  note: string | null;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  usedBy: string | null;
};

const selectCls = "h-11 w-full rounded-control border border-input bg-card px-3 text-base md:text-sm";
const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const TONE: Record<InviteStatus, BadgeTone> = { pendente: "primary", usado: "success", expirado: "neutral", revogado: "danger" };

/** Convites por link de uso único (aluno ou admin). O link aparece uma única vez, logo após criar. */
export function InvitesManager({ rows }: { rows: InviteRow[] }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function revoke(r: InviteRow) {
    start(async () => {
      const res = await revokeInviteAction(r.id);
      if (res.ok) { toast.success("Convite revogado"); router.refresh(); } else toast.error(res.error);
    });
  }

  return (
    <section aria-labelledby="convites" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="convites" className="text-lg font-bold">Convites por link</h2>
          <p className="text-sm text-muted-foreground">A pessoa abre o link e cria a própria conta. Cada link vale para um único cadastro.</p>
        </div>
        <Button variant="outline" onClick={() => { setLink(null); setOpen(true); }}><Link2 aria-hidden /> Convidar</Button>
      </div>

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Convites">
          {rows.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
                <Badge tone={TONE[r.status]}>{r.status}</Badge>
                <span className="font-semibold">{r.role === "admin" ? "Admin" : "Aluno"}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {[r.note, r.email].filter(Boolean).join(" · ") || "sem identificação"}
                  {r.status === "usado" && r.usedBy ? ` → ${r.usedBy}` : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.status === "pendente" ? `vale até ${fmt.format(new Date(r.expiresAt))}` : `criado em ${fmt.format(new Date(r.createdAt))}`}
                </span>
                {r.status === "pendente" && (
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => revoke(r)} aria-label="Revogar convite">
                    <X aria-hidden /> Revogar
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o && link) router.refresh(); }}>
        <DialogContent>
          {link ? <LinkView link={link} /> : <InviteForm onCreated={(token) => setLink(`${window.location.origin}/convite/${token}`)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function InviteForm({ onCreated }: { onCreated: (token: string) => void }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult<{ token: string }> | null>(null);
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const res = await createInviteAction({ role: f.get("role"), email: f.get("email"), note: f.get("note"), days: f.get("days") });
          setResult(res);
          if (res.ok && res.data) onCreated(res.data.token);
        });
      }}
    >
      <DialogTitle>Convidar por link</DialogTitle>
      <DialogDescription>Gera um link de uso único. Envie para a pessoa por WhatsApp ou e-mail.</DialogDescription>
      <div className="grid gap-1.5">
        <Label htmlFor="inv-role">Tipo de conta</Label>
        <select id="inv-role" name="role" defaultValue="student" className={selectCls}>
          <option value="student">Aluno</option>
          <option value="admin">Administrador (acesso total)</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="inv-note">Para quem (opcional)</Label>
        <Input id="inv-note" name="note" maxLength={120} placeholder="Ex.: Ana" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="inv-email">Só aceitar este e-mail (opcional)</Label>
        <Input id="inv-email" name="email" type="email" inputMode="email" aria-invalid={!!errors?.email} aria-describedby={errors?.email ? "inv-email-err" : undefined} />
        <FieldError id="inv-email-err">{errors?.email?.[0]}</FieldError>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="inv-days">Validade (dias)</Label>
        <Input id="inv-days" name="days" type="number" min={1} max={30} defaultValue={7} aria-invalid={!!errors?.days} aria-describedby={errors?.days ? "inv-days-err" : undefined} />
        <FieldError id="inv-days-err">{errors?.days?.[0]}</FieldError>
      </div>
      {result && !result.ok && !errors && <FieldError>{result.error}</FieldError>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />} Gerar link
      </Button>
    </form>
  );
}

function LinkView({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-4">
      <DialogTitle>Link criado</DialogTitle>
      <DialogDescription>Copie agora: por segurança, este link não será mostrado de novo. Ele vale para um único cadastro.</DialogDescription>
      <Input readOnly value={link} aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} className="font-mono text-sm" />
      <Button
        size="lg"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            toast.success("Link copiado");
          } catch {
            toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
          }
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copiado" : "Copiar link"}
      </Button>
    </div>
  );
}
