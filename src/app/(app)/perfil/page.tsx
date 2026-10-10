import { Shield } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_NAV } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { InstallAppButton, ReadingFontControl } from "@/components/reading-prefs";
import { AccountForms } from "@/components/account/account-forms";
import { NotificationSettings } from "@/components/account/notification-settings";
import { readNotifyPrefs } from "@/lib/notifications";
import { emailConfigured } from "@/lib/notify";
import { Badge } from "@/components/ui/badge";
import { describeLimit, PLANS } from "@/lib/plans";
import { isStoreApp } from "@/lib/platform";
import { createClient } from "@/lib/supabase/server";

type MyPlan = {
  plan: string;
  subscription: { status: string; trial_end: string | null; current_period_end: string | null } | null;
  limits: Record<string, { quota: number | null; used: number; remaining: number | null; unlimited: boolean; period: string }>;
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" });

export const metadata: Metadata = { title: "Perfil" };

export default async function PerfilPage() {
  const user = await requireUser();
  const [{ data: mp }, storeApp] = await Promise.all([(await createClient()).rpc("my_plan"), isStoreApp()]);
  const my = mp as MyPlan | null;
  const plan = PLANS.find((p) => p.code === my?.plan) ?? PLANS[0];
  const sub = my?.subscription;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold md:text-3xl">Perfil</h1>
      <Card>
        <CardHeader><CardTitle>Conta</CardTitle></CardHeader>
        <CardContent><AccountForms name={user.fullName} email={user.email} /></CardContent>
      </Card>
      {user.role === "student" && my && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Plano {plan.name}
              {sub?.status === "trialing" && sub.trial_end && <Badge tone="warning">teste até {fmtDate(sub.trial_end)}</Badge>}
              {sub?.status === "active" && sub.current_period_end && <Badge tone="success">renova em {fmtDate(sub.current_period_end)}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {([["simulado", "Simulados por prova"], ["essay_ai", "Correções de redação"], ["tutor_msg", "Tutor IA"], ["export", "Exportar PDF/EPUB"]] as const).map(([k, l]) => {
                const e = my.limits[k];
                return (
                  <li key={k} className="flex justify-between gap-2 rounded-control bg-muted px-3 py-2">
                    <span>{l}</span>
                    <strong>{!e ? describeLimit(plan.limits[k]) : e.unlimited ? "ilimitado" : `${e.remaining ?? 0} de ${e.quota}`}</strong>
                  </li>
                );
              })}
            </ul>
            {/* Modelo "Netflix": assinatura só pelo site. No app das lojas não há preço nem botão de assinar. */}
            <p className="text-muted-foreground">
              {storeApp ? "Para mudar de plano, acesse sua conta pelo site do Vestibularr no navegador." : "A troca de plano e a assinatura são feitas pelo site. Em breve, com pagamento por Pix."}
            </p>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Notificações</CardTitle></CardHeader>
        <CardContent><NotificationSettings initial={readNotifyPrefs(user.preferences.notifications)} emailAvailable={emailConfigured()} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Aparência</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">Claro, escuro ou seguir o sistema.</span>
          <ThemeToggle />
        </CardContent>
      </Card>
      {user.role === "admin" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="size-4" aria-hidden /> Administração</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
              <Button key={href} asChild variant="soft"><Link href={href}><Icon aria-hidden /> {label}</Link></Button>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Leitura</CardTitle></CardHeader>
        <CardContent><ReadingFontControl /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>App no celular</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          <p className="text-sm text-muted-foreground">Instale para abrir como aplicativo e continuar simulados e redações sem internet.</p>
          <InstallAppButton />
        </CardContent>
      </Card>
      <div className="grid grid-cols-3 gap-2">
        <Button asChild variant="outline" size="lg"><Link href="/dicas">Dicas</Link></Button>
        <Button asChild variant="outline" size="lg"><Link href="/busca">Buscar</Link></Button>
        <Button asChild variant="outline" size="lg"><Link href="/guia">Guia</Link></Button>
      </div>
      <LogoutButton variant="full" />
    </div>
  );
}
