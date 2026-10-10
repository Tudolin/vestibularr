"use client";

import { Search, Shield, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ActivityPinger } from "./activity-pinger";
import { LogoutButton } from "./logout-button";
import { OfflineBanner } from "./offline/offline-banner";
import { PageCacher } from "./offline/page-cacher";
import { QueueRunner } from "./offline/queue-runner";
import { ADMIN_NAV, EXTRA_NAV, PROFILE_NAV, STUDENT_NAV, type NavItem } from "./nav";
import { ThemeCycleButton, ThemeToggle } from "./theme-toggle";

export type ShellUser = { name: string; email: string | null; role: "admin" | "student" };

function isActive(pathname: string, item: NavItem) {
  return pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
}

function Brand() {
  return (
    <Link href="/inicio" aria-label="Vestibularr — início" className="flex min-h-11 min-w-0 items-center gap-1.5">
      {/* o mesmo logo da homepage: Capitão Grafite + "vestibularr" em Fredoka */}
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático da marca */}
      <img src="/brand/grafite-rosto.svg" alt="" width={44} height={40} className="h-9 w-10 shrink-0" />
      <span className="truncate font-brand text-[1.45rem] font-bold leading-none tracking-tight text-primary">vestibularr</span>
    </Link>
  );
}

export function AppShell({
  user,
  children,
  pathnameOverride,
}: {
  user: ShellUser;
  children: React.ReactNode;
  /** Só para a página /design, que mostra o shell sem rota real. */
  pathnameOverride?: string;
}) {
  const realPath = usePathname();
  const pathname = pathnameOverride ?? realPath;
  const isAdmin = user.role === "admin";

  return (
    <div className="min-h-dvh overflow-x-clip md:grid md:grid-cols-[16rem_1fr]">
      {!pathnameOverride && <><ActivityPinger /><QueueRunner /><PageCacher /></>}
      {/* Sidebar — desktop */}
      <aside style={{ viewTransitionName: "app-side" }} className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-card p-4 md:flex">
        <Brand />
        <nav aria-label="Principal" className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {[...STUDENT_NAV, PROFILE_NAV, ...EXTRA_NAV].map((item) => (
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
            {pathnameOverride ? null : <LogoutButton />}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Topo — celular */}
        <header style={{ viewTransitionName: "app-header" }} className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur md:hidden">
          <Brand />
          {/* compacto: com fonte grande do sistema, o seletor de 3 botões alargava a página */}
          <div className="flex shrink-0 items-center gap-1">
            <Link href="/busca" aria-label="Buscar" className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"><Search className="size-5" aria-hidden /></Link>
            <ThemeCycleButton />
            <Link href="/perfil" aria-label="Perfil" aria-current={pathname.startsWith("/perfil") ? "page" : undefined}
              className={cn("flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted", pathname.startsWith("/perfil") && "bg-primary-soft text-primary-soft-foreground")}>
              <User className="size-5" aria-hidden />
            </Link>
          </div>
        </header>
        {!pathnameOverride && <OfflineBanner />}
        <main id="conteudo" className="pb-safe-nav mx-auto w-full max-w-5xl flex-1 px-4 pt-6 md:px-8 md:pb-24">
          {children}
        </main>
      </div>

      {/* Barra inferior — celular */}
      <nav
        aria-label="Principal"
        style={{ viewTransitionName: "app-nav" }}
        // minmax(0,1fr): com fonte grande do sistema (Android/iOS), as 5 colunas encolhem em vez de alargar a página
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-[repeat(5,minmax(0,1fr))] border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
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
                "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-semibold",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className={cn("nav-pill flex h-7 w-full max-w-12 items-center justify-center rounded-full transition-colors duration-200", active && "bg-primary-soft")}>
                <Icon className="size-5 shrink-0" aria-hidden />
              </span>
              <span className="max-w-full truncate">{item.label}</span>
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
