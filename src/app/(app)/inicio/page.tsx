import { ClipboardList, Flame, Play, RotateCcw, Target } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Início" };

export default async function InicioPage() {
  const user = await requireUser();
  const first = user.fullName.split(" ")[0] || "estudante";
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold md:text-3xl">Olá, {first}! 👋</h1>
        <p className="text-muted-foreground">Vamos estudar um pouco hoje?</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <HomeCard icon={<Play />} title="Continuar de onde parei" description="Seu último simulado ou treino aparece aqui.">
          <p className="text-sm text-muted-foreground">Nada em andamento. Comece um treino na aba Estudar.</p>
        </HomeCard>
        <HomeCard icon={<Target />} title="Meta do dia" description="Questões resolvidas hoje.">
          <Progress value={0} label="Meta do dia" />
          <p className="mt-2 text-sm text-muted-foreground">0 de 10 questões</p>
        </HomeCard>
        <HomeCard icon={<RotateCcw />} title="Revisão de erros" description="Questões que você errou e devem ser refeitas.">
          <p className="text-sm text-muted-foreground">Nenhum erro pendente por enquanto.</p>
        </HomeCard>
        <HomeCard icon={<ClipboardList />} title="Próximo simulado sugerido" description="Baseado nos seus alvos e no seu desempenho.">
          <p className="text-sm text-muted-foreground">Sugestões aparecem depois da sua primeira prova.</p>
        </HomeCard>
      </div>

      <Card className="flex items-center gap-4 p-5">
        <span className="flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning-soft-foreground">
          <Flame aria-hidden />
        </span>
        <div>
          <p className="font-bold">Sequência: 0 dias</p>
          <p className="text-sm text-muted-foreground">Estude hoje para começar sua sequência.</p>
        </div>
      </Card>
    </div>
  );
}

function HomeCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground [&_svg]:size-5">{icon}</span>
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
