import { notFound } from "next/navigation";
import { Check, Inbox, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SaveIndicator } from "@/components/save-indicator";
import { AreaBadge, Badge, AREAS } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastDemo } from "./toast-demo";

/** Vitrine do design system. Só existe fora de produção (NODE_ENV é inlinado no build). */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();

  async function noop() {
    "use server";
  }

  const bars: [keyof typeof AREAS, number][] = [["linguagens", 72], ["humanas", 58], ["natureza", 41], ["matematica", 86]];
  const barColor = {
    linguagens: "bg-area-linguagens",
    humanas: "bg-area-humanas",
    natureza: "bg-area-natureza",
    matematica: "bg-area-matematica",
  } as const;

  return (
    <AppShell user={{ name: "Ana Souza", email: "ana@exemplo.com", role: "admin" }} logoutAction={noop} pathnameOverride="/estudar">
      <div className="flex flex-col gap-8">
        <header>
          <h1 className="text-3xl font-extrabold">Design system</h1>
          <p className="text-muted-foreground">Tokens, componentes base e estados. Página de desenvolvimento.</p>
        </header>

        <section aria-labelledby="areas" className="grid gap-3">
          <h2 id="areas" className="text-xl font-bold">Cores por área</h2>
          <Card>
            <CardContent className="grid gap-4 pt-5">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(AREAS) as (keyof typeof AREAS)[]).map((a) => <AreaBadge key={a} area={a} />)}
                <Badge tone="success">Acerto</Badge>
                <Badge tone="danger">Erro</Badge>
                <Badge tone="warning">Revisar</Badge>
                <Badge tone="primary">Novo</Badge>
              </div>
              {bars.map(([a, v]) => (
                <div key={a} className="grid gap-1.5">
                  <div className="flex justify-between text-sm font-semibold"><span>{AREAS[a].label}</span><span>{v}%</span></div>
                  <Progress value={v} label={AREAS[a].label} barClassName={barColor[a]} />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="botoes" className="grid gap-3">
          <h2 id="botoes" className="text-xl font-bold">Botões, campos e estado de salvamento</h2>
          <Card>
            <CardContent className="grid gap-4 pt-5">
              <div className="flex flex-wrap gap-2">
                <Button>Primário</Button>
                <Button variant="soft">Suave</Button>
                <Button variant="outline">Contorno</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Perigo</Button>
                <Button disabled>Desabilitado</Button>
              </div>
              <div className="grid max-w-sm gap-1.5">
                <Label htmlFor="demo">Campo de texto</Label>
                <Input id="demo" placeholder="Digite algo" />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <SaveIndicator state="saved" />
                <SaveIndicator state="saving" />
                <SaveIndicator state="offline" pending={3} />
                <ToastDemo />
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="questao" className="grid gap-3">
          <h2 id="questao" className="text-xl font-bold">Alternativas (prévia)</h2>
          <Card>
            <CardHeader>
              <CardTitle>Qual é o resultado de 2 + 2?</CardTitle>
              <CardDescription>Estados de alternativa no treino.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[
                ["A", "3", "idle"],
                ["B", "4", "correct"],
                ["C", "5", "wrong"],
                ["D", "22", "struck"],
              ].map(([l, t, s]) => (
                <div
                  key={l}
                  className={
                    "flex min-h-14 items-center gap-3 rounded-card border px-4 " +
                    (s === "correct" ? "border-success bg-success-soft text-success-soft-foreground" :
                     s === "wrong" ? "border-danger bg-danger-soft text-danger-soft-foreground" :
                     s === "struck" ? "border-border text-muted-foreground line-through" : "border-border bg-card")
                  }
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground">{l}</span>
                  <span className="flex-1 font-medium">{t}</span>
                  {s === "correct" && <Check aria-label="Correta" />}
                  {s === "wrong" && <X aria-label="Errada" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="estados" className="grid gap-3">
          <h2 id="estados" className="text-xl font-bold">Carregando e vazio</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="grid gap-3 p-5">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </Card>
            <EmptyState icon={<Inbox aria-hidden />} title="Nada por aqui" description="Quando houver conteúdo, ele aparece nesta área." />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
