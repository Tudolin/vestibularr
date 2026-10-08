import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell user={{ name: user.fullName, email: user.email, role: user.role }} logoutAction={logoutAction}>
      {children}
    </AppShell>
  );
}
