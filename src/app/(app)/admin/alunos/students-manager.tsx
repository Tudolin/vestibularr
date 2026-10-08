"use client";

import { KeyRound, Loader2, Pencil, Plus, UserCheck, UserX, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError, Input, Label } from "@/components/ui/input";
import type { ActionResult } from "@/lib/validation";
import { createStudentAction, resetPasswordAction, setActiveAction, updateStudentAction } from "./actions";

export type StudentRow = {
  id: string;
  fullName: string;
  email: string | null;
  role: "admin" | "student";
  isActive: boolean;
  lastSeenAt: string | null;
  isMe: boolean;
};

type Modal = { kind: "create" } | { kind: "edit"; row: StudentRow } | { kind: "password"; row: StudentRow } | null;

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function StudentsManager({ rows }: { rows: StudentRow[] }) {
  const [modal, setModal] = useState<Modal>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const students = rows.filter((r) => r.role === "student");
  const admins = rows.filter((r) => r.role === "admin");

  function toggle(row: StudentRow) {
    start(async () => {
      const res = await setActiveAction({ id: row.id, isActive: !row.isActive });
      if (res.ok) {
        toast.success(row.isActive ? "Aluno desativado" : "Aluno reativado");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Alunos</h1>
          <p className="text-sm text-muted-foreground">Só você cria contas. Não há cadastro público.</p>
        </div>
        <Button onClick={() => setModal({ kind: "create" })}>
          <Plus aria-hidden /> Novo aluno
        </Button>
      </header>

      {students.length === 0 ? (
        <EmptyState
          icon={<Users aria-hidden />}
          title="Nenhum aluno ainda"
          description="Crie a conta dos seus irmãos para que eles possam entrar."
          action={<Button onClick={() => setModal({ kind: "create" })}><Plus aria-hidden /> Criar primeiro aluno</Button>}
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Lista de alunos">
          {students.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold">{r.fullName || "Sem nome"}</p>
                    <Badge tone={r.isActive ? "success" : "danger"}>{r.isActive ? "Ativo" : "Desativado"}</Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{r.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Último acesso: {r.lastSeenAt ? fmt.format(new Date(r.lastSeenAt)) : "nunca"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" aria-label={`Editar ${r.fullName}`} onClick={() => setModal({ kind: "edit", row: r })}><Pencil /></Button>
                  <Button variant="outline" size="icon" aria-label={`Redefinir senha de ${r.fullName}`} onClick={() => setModal({ kind: "password", row: r })}><KeyRound /></Button>
                  <Button variant={r.isActive ? "outline" : "soft"} disabled={pending} onClick={() => toggle(r)}>
                    {r.isActive ? <UserX aria-hidden /> : <UserCheck aria-hidden />}
                    {r.isActive ? "Desativar" : "Reativar"}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {admins.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Administradores: {admins.map((a) => a.fullName || a.email).join(", ")}
        </p>
      )}

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent>
          {modal?.kind === "create" && <CreateForm onDone={() => { setModal(null); router.refresh(); }} />}
          {modal?.kind === "edit" && <EditForm row={modal.row} onDone={() => { setModal(null); router.refresh(); }} />}
          {modal?.kind === "password" && <PasswordForm row={modal.row} onDone={() => setModal(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function useSubmit(action: (input: unknown) => Promise<ActionResult>, success: string, onDone: () => void) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  function submit(input: unknown) {
    start(async () => {
      const res = await action(input);
      setResult(res);
      if (res.ok) {
        toast.success(success);
        onDone();
      }
    });
  }
  return { pending, submit, errors: result && !result.ok ? result.fieldErrors : undefined, error: result && !result.ok ? result.error : undefined };
}

function SubmitRow({ pending, label }: { pending: boolean; label: string }) {
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending && <Loader2 className="animate-spin" aria-hidden />} {label}
    </Button>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const { pending, submit, errors, error } = useSubmit(createStudentAction, "Aluno criado", onDone);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        submit({ fullName: f.get("fullName"), email: f.get("email"), password: f.get("password") });
      }}
    >
      <div>
        <DialogTitle>Novo aluno</DialogTitle>
        <DialogDescription>Defina e-mail e senha inicial. Passe os dados para o aluno.</DialogDescription>
      </div>
      <Field name="fullName" label="Nome" errors={errors?.fullName} autoComplete="off" />
      <Field name="email" label="E-mail" type="email" errors={errors?.email} autoComplete="off" />
      <Field name="password" label="Senha inicial (mín. 8)" type="text" errors={errors?.password} autoComplete="off" />
      <FieldError>{!errors ? error : undefined}</FieldError>
      <SubmitRow pending={pending} label="Criar aluno" />
    </form>
  );
}

function EditForm({ row, onDone }: { row: StudentRow; onDone: () => void }) {
  const { pending, submit, errors, error } = useSubmit(updateStudentAction, "Dados salvos", onDone);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit({ id: row.id, fullName: new FormData(e.currentTarget).get("fullName") });
      }}
    >
      <DialogTitle>Editar aluno</DialogTitle>
      <DialogDescription>{row.email}</DialogDescription>
      <Field name="fullName" label="Nome" defaultValue={row.fullName} errors={errors?.fullName} />
      <FieldError>{!errors ? error : undefined}</FieldError>
      <SubmitRow pending={pending} label="Salvar" />
    </form>
  );
}

function PasswordForm({ row, onDone }: { row: StudentRow; onDone: () => void }) {
  const { pending, submit, errors, error } = useSubmit(resetPasswordAction, "Senha redefinida", onDone);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit({ id: row.id, password: new FormData(e.currentTarget).get("password") });
      }}
    >
      <DialogTitle>Redefinir senha</DialogTitle>
      <DialogDescription>{row.fullName || row.email}</DialogDescription>
      <Field name="password" label="Nova senha (mín. 8)" type="text" errors={errors?.password} autoComplete="off" />
      <FieldError>{!errors ? error : undefined}</FieldError>
      <SubmitRow pending={pending} label="Redefinir" />
    </form>
  );
}

function Field({ name, label, errors, ...props }: { name: string; label: string; errors?: string[] } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} required aria-invalid={!!errors} aria-describedby={errors ? `${name}-err` : undefined} {...props} />
      <FieldError id={`${name}-err`}>{errors?.[0]}</FieldError>
    </div>
  );
}
