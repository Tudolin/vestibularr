import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serviceRoleKey } from "@/lib/env";

/**
 * Cliente service-role: IGNORA RLS. Só pode ser usado depois de `requireAdmin()` em server actions,
 * em scripts, ou no resgate de convite (/convite), onde o token de uso único é a autorização.
 * Nunca importar em código de cliente.
 */
export function createAdminClient() {
  return createClient(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
