/** Rótulos das conquistas (as regras ficam no servidor: refresh_achievements). */
export const ACHIEVEMENTS: { code: string; title: string; desc: string; emoji: string }[] = [
  { code: "primeiro_passo", title: "Primeiro passo", desc: "Respondeu a primeira questão", emoji: "👣" },
  { code: "cem_questoes", title: "Centena", desc: "100 questões respondidas", emoji: "💯" },
  { code: "mil_questoes", title: "Milhar", desc: "1.000 questões respondidas", emoji: "🏔️" },
  { code: "primeiro_simulado", title: "Estreia", desc: "Terminou o primeiro simulado", emoji: "📝" },
  { code: "maratonista", title: "Maratonista", desc: "Fez uma prova completa (80+ questões)", emoji: "🏃" },
  { code: "sequencia_7", title: "Uma semana", desc: "7 dias seguidos estudando", emoji: "🔥" },
  { code: "sequencia_30", title: "Um mês", desc: "30 dias seguidos estudando", emoji: "🌟" },
  { code: "primeira_redacao", title: "Primeira redação", desc: "Recebeu a primeira correção", emoji: "✍️" },
  { code: "redacao_800", title: "Nota 800", desc: "Redação ENEM com 800 ou mais", emoji: "🏅" },
  { code: "caderno_limpo", title: "Caderno limpo", desc: "Resolveu 10 erros do caderno", emoji: "🧹" },
  { code: "mestre_assunto", title: "Mestre do assunto", desc: "80%+ de acerto num assunto (20+ questões)", emoji: "🎓" },
];

export const DEFAULT_GOALS = { questions_day: 10, questions_week: 70, minutes_week: 300, essays_week: 1 } as const;
export type GoalKind = keyof typeof DEFAULT_GOALS;
export const GOAL_LABEL: Record<GoalKind, string> = {
  questions_day: "Questões por dia",
  questions_week: "Questões por semana",
  minutes_week: "Minutos de estudo por semana",
  essays_week: "Redações por semana",
};
