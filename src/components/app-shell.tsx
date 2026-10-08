"use client";

import { GraduationCap, LogOut, Shield } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ActivityPinger } from "./activity-pinger";
import { ADMIN_NAV, STUDENT_NAV, type NavItem } from "./nav";
import { ThemeToggle } from "./theme-toggle";

export type ShellUser = { name: string; email: string | null; role: "admin" | "student" };

function isActive(pathname: string, item: NavItem) {
  return pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
}

function Brand() {
  return (
    <Link href="/inicio" className="flex items-center gap-2 font-display text-lg font-extrabold">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <GraduationCap className="size-5" aria-hidden />
      </span>
      Vestibularr
    </Link>
  );
}

export function AppShell({
  user,
  children,
  logoutAction,
  pathnameOverride,
}: {
  user: ShellUser;
  children: React.ReactNode;
  logoutAction: () => Promise<void>;
  /** Só para a página /design, que mostra o shell sem rota real. */
  pathnameOverride?: string;
}) {
  const realPath = usePathname();
  const pathname = pathnameOverride ?? realPath;
  const isAdmin = user.role === "admin";

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      {!pathnameOverride && <ActivityPinger />}
      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-card p-4 md:flex">
        <Brand />
        <nav aria-label="Principal" className="flex flex-1 flex-col gap-1">
          {STUDENT_NAV.map((item) => (
            <SideLink key={item.href} item={item} active={isActive(pathname, item)} />
          ))}
          {isAdmin && (
            <>
              <p className="mt-4 flex items-center gap-1.5 px-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Shield className="size-3.5" aria-hidden /> Administração
              </p>
              {ADMIN_NAV.map((item) => (
                <SideLink key={item.href} item={item} active={isActive(pathname, item)} />
              ))}
            </>
          )}
        </nav>
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="min-w-0 px-1">
            <p className="truncate text-sm font-semibold">{user.name || "Sem nome"}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <form action={logoutAction}>
              <button aria-label="Sair" className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted md:size-9">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Topo — celular */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-2 backdrop-blur md:hidden">
          <Brand />
          <ThemeToggle />
        </header>
        <main id="conteudo" className="pb-safe-nav mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8 md:pb-10">
          {children}
        </main>
      </div>

      {/* Barra inferior — celular */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {STUDENT_NAV.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-primary-soft")}>
                <Icon className="size-5" aria-hidden />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center gap-3 rounded-control px-3 text-sm font-semibold",
        active ? "bg-primary-soft text-primary-soft-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden />
      {item.label}
    </Link>
  );
}
