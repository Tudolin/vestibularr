import { Shield } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "../../login/actions";

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
        <Button asChild variant="soft" size="lg">
          <Link href="/admin/alunos"><Shield aria-hidden /> Administração de alunos</Link>
        </Button>
      )}
      <form action={logoutAction}>
        <Button type="submit" variant="outline" size="lg" className="w-full">Sair</Button>
      </form>
    </div>
  );
}
