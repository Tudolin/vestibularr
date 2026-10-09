import "server-only";

/**
 * Verifica o token do Cloudflare Turnstile (anti-robô do cadastro). Sem TURNSTILE_SECRET_KEY
 * (desenvolvimento/testes) a verificação é desligada; em produção configure as duas chaves.
 */
export async function verifyTurnstile(token: string | null, ip?: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) });
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
