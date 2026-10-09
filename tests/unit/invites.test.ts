import { describe, expect, it } from "vitest";
import { hashInviteToken, inviteStatus, isInviteTokenShape, newInviteToken } from "@/lib/invites";

describe("tokens de convite", () => {
  it("gera token de 256 bits em base64url e guarda só o hash SHA-256", () => {
    const { token, hash } = newInviteToken();
    expect(isInviteTokenShape(token)).toBe(true);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken(token)).toBe(hash);
    expect(newInviteToken().token).not.toBe(token);
  });

  it("rejeita formatos estranhos", () => {
    expect(isInviteTokenShape("abc")).toBe(false);
    expect(isInviteTokenShape("../".repeat(15))).toBe(false);
  });

  it("status: usado > revogado > expirado > pendente", () => {
    const now = Date.parse("2026-10-09T12:00:00Z");
    const base = { used_at: null, revoked_at: null, expires_at: "2026-10-10T00:00:00Z" };
    expect(inviteStatus(base, now)).toBe("pendente");
    expect(inviteStatus({ ...base, expires_at: "2026-10-09T11:00:00Z" }, now)).toBe("expirado");
    expect(inviteStatus({ ...base, revoked_at: "x" }, now)).toBe("revogado");
    expect(inviteStatus({ ...base, used_at: "x", revoked_at: "x" }, now)).toBe("usado");
  });
});
