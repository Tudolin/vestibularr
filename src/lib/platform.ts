import "server-only";
import { headers } from "next/headers";

/**
 * Rodando dentro do app das lojas (casca Capacitor, que acrescenta "VestibularrApp/<versão>" ao user agent)?
 * Modelo "Netflix": a assinatura é feita só pelo site. Dentro do app de loja não mostramos preços nem botões
 * de assinar (regra da Apple/Google para compras digitais fora do sistema delas).
 */
export async function isStoreApp(): Promise<boolean> {
  return /VestibularrApp\//.test((await headers()).get("user-agent") ?? "");
}
