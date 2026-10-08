import { BarChart3, BookMarked, BookOpen, Database, FileText, FileUp, Home, ListChecks, NotebookPen, PenLine, Scale, User, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; match?: string[] };

/** Barra inferior no celular / sidebar no desktop. */
export const STUDENT_NAV: NavItem[] = [
  { href: "/inicio", label: "Início", icon: Home },
  { href: "/estudar", label: "Estudar", icon: BookOpen },
  { href: "/redacao", label: "Redação", icon: PenLine },
  { href: "/desempenho", label: "Desempenho", icon: BarChart3 },
  { href: "/perfil", label: "Perfil", icon: User },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/alunos", label: "Alunos", icon: Users },
  { href: "/admin/questoes", label: "Questões", icon: Database },
  { href: "/admin/importar", label: "Importar", icon: FileUp },
  { href: "/admin/provas", label: "Provas", icon: FileText },
  { href: "/admin/obras", label: "Obras UFPR", icon: BookMarked },
  { href: "/admin/redacoes", label: "Redações", icon: NotebookPen },
  { href: "/admin/temas", label: "Temas", icon: ListChecks },
  { href: "/admin/rubricas", label: "Rubricas", icon: Scale },
];
