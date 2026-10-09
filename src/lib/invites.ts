import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Token do convite: 32 bytes aleatórios (base64url). Só o hash vai para o banco. */
export function newInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const isInviteTokenShape = (t: string) => /^[A-Za-z0-9_-]{43}$/.test(t);

export type InviteStatus = "pendente" | "usado" | "expirado" | "revogado";

export function inviteStatus(i: { used_at: string | null; revoked_at: string | null; expires_at: string }, now = Date.now()): InviteStatus {
  if (i.used_at) return "usado";
  if (i.revoked_at) return "revogado";
  if (new Date(i.expires_at).getTime() <= now) return "expirado";
  return "pendente";
}
