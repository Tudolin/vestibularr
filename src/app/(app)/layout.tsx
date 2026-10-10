import { AppShell } from "@/components/app-shell";
import { StudyDock } from "@/components/study-dock/study-dock";
import { WelcomeGuide } from "@/components/welcome-guide";
import { requireUser } from "@/lib/auth";
import { GUIDE_PREF } from "@/lib/guide";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell user={{ name: user.fullName, email: user.email, role: user.role }}>
      {children}
      <StudyDock initialTools={user.preferences.study_tools} initialNotes={typeof user.preferences.study_notes === "string" ? user.preferences.study_notes : ""} />
      <WelcomeGuide show={user.preferences[GUIDE_PREF] !== true && (user.role === "admin" || user.preferences.onboarded === true)} />
    </AppShell>
  );
}
