"use client";

import { CreditCard, KeyRound, Loader2, Pencil, Plus, Search, UserCheck, UserX, Users } from "lucide-react";
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
import { PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { createStudentAction, resetPasswordAction, setActiveAction, setPlanAction, updateStudentAction } from "./actions";

export type StudentRow = {
  id: string;
  fullName: string;
  email: string | null;
  role: "admin" | "student";
  isActive: boolean;
  lastSeenAt: string | null;
  isMe: boolean;
  plan: { code: string; status: string; trialEnd: string | null; periodEnd: string | null } | null;
};

const PLAN_NAME: Record<string, string> = Object.fromEntries(PLANS.map((p) => [p.code, p.name]));
const day = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

/** Plano que vale hoje pela assinatura (sem contar o beta): igual à regra do banco (_effective_plan). */
function planNow(p: StudentRow["plan"], now: number) {
  if (!p) return { code: "free", label: "Grátis", note: "sem assinatura" };
  if (p.status === "trialing" && p.trialEnd && new Date(p.trialEnd).getTime() > now) return { code: p.code, label: PLAN_NAME[p.code] ?? p.code, note: `teste até ${day.format(new Date(p.trialEnd))}` };
  if ((p.status === "active" || p.status === "past_due") && p.code !== "free" && (!p.periodEnd || new Date(p.periodEnd).getTime() > now))
    return { code: p.code, label: PLAN_NAME[p.code] ?? p.code, note: p.periodEnd ? `até ${day.format(new Date(p.periodEnd))}` : "sem vencimento" };
  return { code: "free", label: "Grátis", note: p.code !== "free" ? `${PLAN_NAME[p.code] ?? p.code} vencido` : "" };
}
const PLAN_TONE: Record<string, "neutral" | "primary" | "success" | "warning"> = { free: "neutral", estudante: "primary", pro: "success", familia: "warning" };

type Modal = { kind: "create" } | { kind: "edit"; row: StudentRow } | { kind: "password"; row: StudentRow } | { kind: "plan"; row: StudentRow } | null;

const fmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export function StudentsManager({ rows, beta }: { rows: StudentRow[]; beta: boolean }) {
  const [modal, setModal] = useState<Modal>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("todos");
  const allStudents = rows.filter((r) => r.role === "student");
  const counts = allStudents.reduce<Record<string, number>>((acc, r) => { const c = planNow(r.plan, now).code; acc[c] = (acc[c] ?? 0) + 1; return acc; }, {});
  const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const students = allStudents.filter((r) => (planFilter === "todos" || planNow(r.plan, now).code === planFilter)
    && (!query.trim() || norm(`${r.fullName} ${r.email ?? ""}`).includes(norm(query.trim()))));
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
          <p className="text-sm text-muted-foreground">Contas do cadastro público, criadas aqui ou por convite. Gerencie dados, acesso e plano de cada aluno.</p>
        </div>
        <Button onClick={() => setModal({ kind: "create" })}>
          <Plus aria-hidden /> Novo aluno
        </Button>
      </header>

      {allStudents.length > 0 && (
        <div className="grid gap-3">
          <div role="radiogroup" aria-label="Filtrar por plano" className="flex flex-wrap gap-2">
            {[["todos", `Todos · ${allStudents.length}`], ...PLANS.map((p) => [p.code, `${p.name} · ${counts[p.code] ?? 0}`])].map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={planFilter === v} onClick={() => setPlanFilter(v)}
                className={cn("min-h-10 rounded-full border px-4 text-sm font-semibold", planFilter === v ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-input bg-card hover:bg-muted")}>{l}</button>
            ))}
          </div>
          <label className="relative max-w-sm">
            <span className="sr-only">Buscar aluno</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou e-mail" className="pl-9" />
          </label>
          {beta && <p className="rounded-control bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">Beta ligado: agora todos usam o Pro. O plano de cada aluno passa a valer quando você desligar o beta.</p>}
        </div>
      )}

      {students.length === 0 && allStudents.length > 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum aluno com esse filtro.</p>
      ) : students.length === 0 ? (
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
                    {(() => { const pl = planNow(r.plan, now); return <Badge tone={PLAN_TONE[pl.code] ?? "neutral"}>{pl.label}{pl.note ? ` · ${pl.note}` : ""}</Badge>; })()}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{r.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Último acesso: {r.lastSeenAt ? fmt.format(new Date(r.lastSeenAt)) : "nunca"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="soft" onClick={() => setModal({ kind: "plan", row: r })}><CreditCard aria-hidden /> Plano</Button>
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
          {modal?.kind === "plan" && <PlanForm row={modal.row} now={now} onDone={() => { setModal(null); router.refresh(); }} />}
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

const VALIDITY = [["sem", "Sem vencimento"], ["1", "1 mês"], ["3", "3 meses"], ["12", "1 ano"], ["data", "Até uma data"]] as const;
const plusMonths = (now: number, m: number) => { const d = new Date(now); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10); };

function PlanForm({ row, now, onDone }: { row: StudentRow; now: number; onDone: () => void }) {
  const current = planNow(row.plan, now);
  const [plan, setPlan] = useState(current.code);
  const [validity, setValidity] = useState<(typeof VALIDITY)[number][0]>("sem");
  const [date, setDate] = useState(plusMonths(now, 1));
  const { pending, submit, error } = useSubmit(setPlanAction, "Plano atualizado", onDone);
  const until = plan === "free" || validity === "sem" ? null : validity === "data" ? date : plusMonths(now, Number(validity));
  return (
    <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); submit({ id: row.id, plan, until }); }}>
      <div>
        <DialogTitle>Plano de {row.fullName || row.email}</DialogTitle>
        <DialogDescription>Hoje: {current.label}{current.note ? ` (${current.note})` : ""}. Use para cortesia, bolsa ou correção manual.</DialogDescription>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-bold">Plano</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2">
          {PLANS.map((p) => (
            <button key={p.code} type="button" role="radio" aria-checked={plan === p.code} onClick={() => setPlan(p.code)}
              className={cn("min-h-14 rounded-control border-2 px-3 py-2 text-left", plan === p.code ? "border-primary bg-primary-soft" : "border-input bg-card hover:bg-muted")}>
              <span className="block font-display font-semibold">{p.name}</span>
              <span className="block text-xs text-muted-foreground">{p.tagline}</span>
            </button>
          ))}
        </div>
      </fieldset>
      {plan !== "free" && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-bold">Validade</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {VALIDITY.map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={validity === v} onClick={() => setValidity(v)}
                className={cn("min-h-10 rounded-full border px-4 text-sm font-semibold", validity === v ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-input bg-card hover:bg-muted")}>{l}</button>
            ))}
          </div>
          {validity === "data" && <Input type="date" aria-label="Vence em" value={date} min={plusMonths(now, 0)} onChange={(e) => setDate(e.target.value)} className="max-w-48" />}
          <p className="text-xs text-muted-foreground">{until ? `Vale até ${day.format(new Date(`${until}T12:00:00`))}; depois volta ao Grátis.` : "Vale até você mudar."}</p>
        </fieldset>
      )}
      <FieldError>{error}</FieldError>
      <SubmitRow pending={pending} label="Salvar plano" />
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
