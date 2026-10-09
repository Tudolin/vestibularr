import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido")),
  password: z.string().min(1, "Informe a senha"),
});

export const createStudentSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido")),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres").max(72),
});

export const updateStudentSchema = z.object({
  id: z.uuid(),
  fullName: z.string().trim().min(2, "Informe o nome").max(80),
});

export const setActiveSchema = z.object({ id: z.uuid(), isActive: z.boolean() });
export const resetPasswordSchema = z.object({
  id: z.uuid(),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres").max(72),
});

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export const createInviteSchema = z.object({
  role: z.enum(["student", "admin"]),
  email: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().toLowerCase().pipe(z.email("E-mail inválido")).optional()),
  note: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(120).optional()),
  days: z.coerce.number().int().min(1, "Mínimo 1 dia").max(30, "Máximo 30 dias"),
});

export const redeemInviteSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Convite inválido"),
    fullName: z.string().trim().min(2, "Informe o nome").max(80),
    email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido")),
    password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "As senhas não conferem", path: ["confirm"] });
