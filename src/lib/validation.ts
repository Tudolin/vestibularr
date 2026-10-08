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
