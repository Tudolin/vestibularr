import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { RECOVERY_COOKIE, RECOVERY_MAX_AGE, RECOVERY_PATH } from "@/lib/recovery";
import { createClient } from "@/lib/supabase/server";

/**
 * Link de confirmação do e-mail. Aceita os dois formatos do Supabase:
 * ?token_hash=…&type=email (template recomendado no README) ou ?code=… (fluxo PKCE padrão).
 * Link de "esqueci minha senha" (type=recovery) sempre leva para a tela de senha nova.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const nextParam = url.searchParams.get("next") ?? "/onboarding";
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const recovery = type === "recovery" || nextParam === RECOVERY_PATH;
  const next = recovery ? RECOVERY_PATH : nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/onboarding";
  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  else if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  const dest = url.clone();
  dest.search = "";
  dest.pathname = ok ? next : recovery ? "/esqueci-senha" : "/login";
  if (!ok) dest.searchParams.set("erro", "link");
  const res = NextResponse.redirect(dest);
  if (ok && recovery) {
    res.cookies.set(RECOVERY_COOKIE, "1", { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/", maxAge: RECOVERY_MAX_AGE });
  }
  return res;
}
