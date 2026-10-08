import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WorksManager, type WorkRow } from "./works-manager";

export const metadata: Metadata = { title: "Obras literárias" };

export default async function AdminObrasPage() {
  await requireAdmin();
  const { data } = await (await createClient()).from("literary_works").select("id, title, author, year_from, year_to, notes").order("title");
  return <WorksManager rows={(data ?? []) as WorkRow[]} />;
}
