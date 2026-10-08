import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ThemesManager, type ThemeRow } from "./themes-manager";

export const metadata: Metadata = { title: "Temas de redação" };

export default async function TemasPage() {
  await requireAdmin();
  const { data } = await (await createClient()).from("essay_themes").select("*").order("kind").order("year", { ascending: false, nullsFirst: true });
  return <ThemesManager rows={(data ?? []) as ThemeRow[]} />;
}
