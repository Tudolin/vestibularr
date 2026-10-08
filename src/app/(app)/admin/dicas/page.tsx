import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TipsManager, type TipRow } from "./tips-manager";

export const metadata: Metadata = { title: "Dicas (admin)" };

export default async function AdminDicas() {
  await requireAdmin();
  const { data } = await (await createClient()).from("tips").select("*").order("sort").order("title");
  return <TipsManager rows={(data ?? []) as TipRow[]} />;
}
