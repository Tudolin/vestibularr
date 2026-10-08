import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CoursesManager, type CourseAdminRow } from "./courses-manager";

export const metadata: Metadata = { title: "Cursos e notas de corte" };

export default async function CursosPage() {
  await requireAdmin();
  const { data } = await (await createClient())
    .from("courses")
    .select("id, institution, via, name, campus, shift, notes, ufpr_specific, sisu_weights, course_cutoffs(id, year, modality, cutoff, source)")
    .eq("is_active", true)
    .order("institution").order("campus").order("name");
  return <CoursesManager rows={(data ?? []) as CourseAdminRow[]} />;
}
