/** Tipos de feedback (iguais ao check da tabela public.feedback, migration 0022). */
export const FEEDBACK_KINDS = [
  { key: "elogio", label: "Elogio", emoji: "👏", hint: "O que você mais curtiu? Conta pra gente!" },
  { key: "ideia", label: "Ideia", emoji: "💡", hint: "Que funcionalidade faria diferença no seu estudo?" },
  { key: "melhoria", label: "Melhoria", emoji: "🔧", hint: "O que ficou confuso ou poderia ser mais fácil?" },
  { key: "problema", label: "Problema", emoji: "🐞", hint: "O que aconteceu? Em qual tela? O que você esperava que acontecesse?" },
] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]["key"];

export const FEEDBACK_STATUS: Record<string, { label: string; tone: "neutral" | "primary" | "success" }> = {
  novo: { label: "Recebido", tone: "neutral" },
  lido: { label: "Lido pela equipe", tone: "primary" },
  resolvido: { label: "Resolvido", tone: "success" },
};

/** Telas para o aluno dizer de onde é o feedback (o ?de= da URL já preenche). */
export const FEEDBACK_PAGES = [
  ["", "Geral / não sei"],
  ["/inicio", "Início"],
  ["/estudar", "Estudar"],
  ["/prova", "Simulado ou treino"],
  ["/triagem", "Triagem"],
  ["/redacao", "Redação"],
  ["/tripulacao", "Tripulação"],
  ["/desempenho", "Desempenho"],
  ["/perfil", "Perfil e conta"],
] as const;

/** Normaliza o caminho de origem para uma das telas da lista (ex.: /prova/123 -> /prova). */
export function feedbackPage(path: string | undefined | null): string {
  if (!path) return "";
  const hit = FEEDBACK_PAGES.find(([p]) => p && (path === p || path.startsWith(`${p}/`)));
  return hit ? hit[0] : "";
}

export const RATING_FACES = ["😣", "🙁", "😐", "🙂", "🤩"] as const;
