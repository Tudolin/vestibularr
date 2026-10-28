import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { RECOVERY_COOKIE } from "@/lib/recovery";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Criar senha nova" };

export default async function NewPasswordPage() {
  const user = await requireUser();
  const valid = (await cookies()).get(RECOVERY_COOKIE)?.value === "1";
  return (
    <main id="conteudo" className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca */}
        <img src="/brand/grafite-rosto.svg" alt="" width={88} height={80} className="h-20 w-22" />
        <h1 className="font-display text-2xl font-bold">Crie uma senha nova</h1>
        <p className="text-muted-foreground">
          {valid ? <>Para a conta <b className="text-foreground">{user.email}</b>. Depois de salvar, você continua logado aqui e sai dos outros aparelhos.</>
            : "Este link já foi usado ou passou do prazo de 15 minutos."}
        </p>
      </div>
      {valid ? <NewPasswordForm email={user.email} /> : (
        <div className="flex flex-col gap-3 text-center text-sm">
          <Link href="/perfil" className="font-semibold text-primary underline underline-offset-2">Trocar a senha no Perfil (pede a senha atual)</Link>
          <Link href="/inicio" className="text-muted-foreground underline underline-offset-2">Voltar ao início</Link>
        </div>
      )}
    </main>
  );
}
