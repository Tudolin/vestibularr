import { BarChart3, BookOpen, Home, PenLine, User, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; match?: string[] };

/** Barra inferior no celular / sidebar no desktop. */
export const STUDENT_NAV: NavItem[] = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/estudar", label: "Estudar", icon: BookOpen },
  { href: "/redacao", label: "Redação", icon: PenLine },
  { href: "/desempenho", label: "Desempenho", icon: BarChart3 },
  { href: "/perfil", label: "Perfil", icon: User },
];

export const ADMIN_NAV: NavItem[] = [{ href: "/admin/alunos", label: "Alunos", icon: Users }];
