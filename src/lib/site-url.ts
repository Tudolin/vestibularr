import "server-only";
import { headers } from "next/headers";

/**
 * URL pública do site, usada nos links dos e-mails (confirmação de cadastro, troca de e-mail).
 * Ordem: NEXT_PUBLIC_SITE_URL; em produção no Vercel, o domínio de produção do projeto (os endereços
 * de cada deploy, tipo projeto-hash-time.vercel.app, ficam atrás do login do Vercel e mandariam a pessoa para
 * uma tela de "pedir acesso"); por fim, a origem da requisição (desenvolvimento local).
 */
export async function siteUrl(): Promise<string> {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL;
  if (fixed) return fixed.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod && process.env.VERCEL_ENV === "production") return `https://${prod.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
