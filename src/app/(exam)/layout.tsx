import { ActivityPinger } from "@/components/activity-pinger";
import { requireUser } from "@/lib/auth";

/** Tela cheia para a prova: sem barra de navegação (foco total). A sessão ainda é exigida. */
export default async function ExamLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="min-h-dvh bg-background">
      <ActivityPinger />
      {children}
    </div>
  );
}
