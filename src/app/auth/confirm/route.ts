import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Link de confirmação do e-mail. Aceita os dois formatos do Supabase:
 * ?token_hash=…&type=email (template recomendado no README) ou ?code=… (fluxo PKCE padrão).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const nextParam = url.searchParams.get("next") ?? "/onboarding";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/onboarding";
  const supabase = await createClient();
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  let ok = false;
  if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  else if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  const dest = url.clone();
  dest.search = "";
  dest.pathname = ok ? next : "/login";
  if (!ok) dest.searchParams.set("erro", "link");
  return NextResponse.redirect(dest);
}
