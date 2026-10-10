import { ActivityPinger } from "@/components/activity-pinger";
import { StudyDock } from "@/components/study-dock/study-dock";
import { requireUser } from "@/lib/auth";

/** Tela cheia para a prova: sem barra de navegação (foco total). A sessão ainda é exigida. */
export default async function ExamLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh bg-background">
      <ActivityPinger />
      {children}
      {/* pomodoro continua contando durante a prova (o botão fica recolhido) */}
      <StudyDock context="exam" initialTools={user.preferences.study_tools} initialNotes={typeof user.preferences.study_notes === "string" ? user.preferences.study_notes : ""} />
    </div>
  );
}
