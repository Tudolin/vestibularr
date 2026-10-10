import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ProfileSetup } from "./profile-setup";

/** Antes de adicionar amigos ou entrar numa tripulação, a pessoa escolhe o @apelido (é como os outros a veem). */
export async function NeedsUsername({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = user ? await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle() : { data: null };
  if (data?.username) return <>{children}</>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Antes, escolha seu @apelido e avatar: é assim que os outros vão te ver.</p>
      <Card><CardContent className="pt-6"><ProfileSetup /></CardContent></Card>
    </div>
  );
}
