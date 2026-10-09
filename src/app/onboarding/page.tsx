import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/marketing/site-chrome";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Bem-vindo" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.preferences.onboarded === true) redirect("/inicio");
  const { data } = await (await createClient())
    .from("courses").select("id, institution, name, campus, shift").eq("is_active", true).order("name");
  const courses = (data ?? []).map((c) => ({
    id: c.id,
    label: [c.name, c.institution, c.campus, c.shift].filter(Boolean).join(" · "),
  }));
  return (
    <main id="conteudo" className="min-h-dvh bg-creme">
      <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-8">
        <div className="flex items-center justify-between">
          <Logo />
          {/* eslint-disable-next-line @next/next/no-img-element -- mascote */}
          <img src="/brand/grafite-rosto-feliz.svg" alt="" width={64} height={58} />
        </div>
        <OnboardingWizard name={user.fullName} courses={courses} />
      </div>
    </main>
  );
}
