"use client";

import { Download, KeyRound, LogOut, Mail, Trash2, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changeEmailAction, changePasswordAction, deleteAccountAction, signOutEverywhereAction, updateNameAction } from "@/app/(app)/perfil/conta-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Open = null | "nome" | "email" | "senha" | "excluir";

/** Conta: nome, e-mail, senha, sair de todos os aparelhos, baixar dados e excluir conta. */
export function AccountForms({ name, email }: { name: string; email: string | null }) {
  const [open, setOpen] = useState<Open>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const close = () => { setOpen(null); setError(null); };
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => start(async () => {
    setError(null);
    const r = await fn();
    if (!r.ok) return setError(r.error ?? "Erro.");
    toast.success(ok);
    close();
  });

  return (
    <div className="grid gap-1">
      <Row icon={<UserRound aria-hidden />} label="Nome" value={name || "—"} onClick={() => setOpen("nome")} />
      <Row icon={<Mail aria-hidden />} label="E-mail" value={email ?? "—"} onClick={() => setOpen("email")} />
      <Row icon={<KeyRound aria-hidden />} label="Senha" value="••••••••" onClick={() => setOpen("senha")} />
      <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
        <Button asChild variant="outline"><a href="/api/conta/exportar" download><Download aria-hidden /> Baixar meus dados</a></Button>
        <form action={signOutEverywhereAction}><Button type="submit" variant="outline" className="w-full"><LogOut aria-hidden /> Sair de todos os aparelhos</Button></form>
      </div>
      <Button variant="ghost" className="mt-1 justify-start text-danger" onClick={() => setOpen("excluir")}><Trash2 aria-hidden /> Excluir minha conta</Button>

      <Dialog open={open !== null} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          {open === "nome" && (
            <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get("nome"); run(() => updateNameAction(v), "Nome atualizado."); }}>
              <DialogTitle>Seu nome</DialogTitle>
              <DialogDescription>Aparece só para você e para o administrador. Na Tripulação, os outros veem só o @apelido.</DialogDescription>
              <Input name="nome" defaultValue={name} maxLength={80} autoComplete="name" required />
              <Footer pending={pending} error={error} />
            </form>
          )}
          {open === "email" && (
            <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get("email"); run(() => changeEmailAction(v), "Enviamos um link de confirmação para o novo e-mail."); }}>
              <DialogTitle>Trocar e-mail</DialogTitle>
              <DialogDescription>Vamos mandar um link de confirmação. O e-mail só muda depois que você clicar nele.</DialogDescription>
              <Input name="email" type="email" inputMode="email" autoComplete="email" placeholder="novo@email.com" required />
              <Footer pending={pending} error={error} />
            </form>
          )}
          {open === "senha" && (
            <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => changePasswordAction({ current: f.get("atual"), next: f.get("nova") }), "Senha trocada."); }}>
              <DialogTitle>Trocar senha</DialogTitle>
              <label className="grid gap-1.5 text-sm font-semibold">Senha atual<Input name="atual" type="password" autoComplete="current-password" required /></label>
              <label className="grid gap-1.5 text-sm font-semibold">Nova senha (mínimo 8)<Input name="nova" type="password" autoComplete="new-password" minLength={8} required /></label>
              <Footer pending={pending} error={error} />
            </form>
          )}
          {open === "excluir" && (
            <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => deleteAccountAction({ password: f.get("senha"), confirm: f.get("confirma") }), "Conta excluída."); }}>
              <DialogTitle className="text-danger">Excluir minha conta</DialogTitle>
              <DialogDescription>
                Apaga para sempre seus simulados, redações, desempenho, XP, amizades e tripulações. Não dá para desfazer.
                Se tiver assinatura, cancele antes no site. Quer guardar algo? Use “Baixar meus dados” primeiro.
              </DialogDescription>
              <label className="grid gap-1.5 text-sm font-semibold">Digite EXCLUIR<Input name="confirma" autoComplete="off" autoCapitalize="characters" required /></label>
              <label className="grid gap-1.5 text-sm font-semibold">Sua senha<Input name="senha" type="password" autoComplete="current-password" required /></label>
              {error && <p role="alert" className="text-sm text-danger">{error}</p>}
              <Button type="submit" variant="danger" size="lg" disabled={pending}>{pending ? "Excluindo…" : "Excluir para sempre"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 rounded-control px-3 text-left hover:bg-muted [&_svg]:size-5 [&_svg]:text-muted-foreground">
      {icon}
      <span className="min-w-0 flex-1"><span className="block font-semibold">{label}</span>{value && <span className="block truncate text-sm text-muted-foreground">{value}</span>}</span>
      <span className="text-sm font-semibold text-primary">Alterar</span>
    </button>
  );
}

function Footer({ pending, error }: { pending: boolean; error: string | null }) {
  return (
    <>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
    </>
  );
}
