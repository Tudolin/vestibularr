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

export const metadata: Metadata = { title: "Perfil" };

export default async function PerfilPage() {
  const user = await requireUser();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold md:text-3xl">Perfil</h1>
      <Card>
        <CardHeader><CardTitle>{user.fullName || "Sem nome"}</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">{user.email}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Aparência</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
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
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline" size="lg"><Link href="/dicas">Dicas</Link></Button>
        <Button asChild variant="outline" size="lg"><Link href="/busca">Buscar</Link></Button>
      </div>
      <LogoutButton variant="full" />
    </div>
  );
}
