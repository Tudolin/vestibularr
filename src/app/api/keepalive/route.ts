import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * O plano gratuito do Supabase pausa projetos sem atividade. A Vercel chama esta rota uma vez
 * por dia (vercel.json → crons) com `Authorization: Bearer $CRON_SECRET`; fazemos uma consulta mínima.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { error } = await createAdminClient().from("settings").select("key").limit(1);
  return NextResponse.json({ ok: !error, at: new Date().toISOString() }, { status: error ? 500 : 200 });
}
