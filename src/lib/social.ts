/** Social e gamificação: tipos das RPCs e tabelas de apresentação (divisões, avatares, boosts). */

export type Card = { id: string; username: string | null; avatar: { emoji: string; color: AvatarColor }; week_xp: number; level: number; streak: number };
export type SearchCard = Card & { relation: "none" | "pending" | "accepted"; requested_by_me: boolean | null };
export type Boost = { id: number; kind: "vento" | "empurrao"; message: string | null; at: string; expires_at: string | null; from: Card };
export type FeedEvent = {
  id: number; kind: "simulado" | "triagem" | "redacao" | "nivel" | "sequencia" | "liga" | "tripulacao";
  payload: Record<string, unknown>; at: string; user: Card; reactions: Record<string, number>; mine: string[];
};
export type CrewSummary = { id: string; name: string; emoji: string; role: "captain" | "member"; members: number; week_xp: number };
export type Overview = {
  me: Card & { total_xp: number; boost_until: string | null };
  week_end: string;
  friends: Card[];
  incoming: Card[];
  outgoing: Card[];
  boosts: Boost[];
  sent_today: { vento: boolean; empurrao: string[] };
  league: { tier: number; moved: number; members: Card[] } | null;
  crews: CrewSummary[];
};
export type CrewDetail = { id: string; name: string; emoji: string; invite_code: string; owner: boolean; members: (Card & { role: string })[]; feed: FeedEvent[] };

/** Divisões da liga (tema pirata), da 0 à 6. */
export const TIERS = [
  { name: "Grumete", emoji: "🪵", tone: "bg-[#c8a27a]/25 text-[#7a4f22] dark:text-[#e6c49d]" },
  { name: "Marujo", emoji: "⚓", tone: "bg-[#9aa7b8]/25 text-[#3e4b5c] dark:text-[#c5d0dd]" },
  { name: "Navegante", emoji: "🧭", tone: "bg-area-matematica-soft text-area-matematica-foreground" },
  { name: "Imediato", emoji: "🗺️", tone: "bg-area-natureza-soft text-area-natureza-foreground" },
  { name: "Capitão", emoji: "🏴‍☠️", tone: "bg-area-linguagens-soft text-area-linguagens-foreground" },
  { name: "Almirante", emoji: "👑", tone: "bg-area-humanas-soft text-area-humanas-foreground" },
  { name: "Lenda dos Mares", emoji: "🐉", tone: "bg-danger-soft text-danger-soft-foreground" },
] as const;
export const PROMOTE = 7; // top 7 sobe
export const DEMOTE = 5; // 5 últimos descem (grupos com 10+)

export const AVATAR_EMOJIS = ["🐱", "🦊", "🐼", "🐸", "🦉", "🐙", "🦈", "🐢", "🦜", "🐳", "🦁", "🐧", "🐨", "🦄", "🐝", "🐲"] as const;
export const AVATAR_COLORS = {
  cobalto: "bg-[#2f3cff] text-white",
  coral: "bg-[#ff6b5e] text-white",
  menta: "bg-[#1fcb8b] text-[#0b3b2a]",
  gema: "bg-[#ffc83d] text-[#4a3500]",
  tinta: "bg-[#14123a] text-white",
  roxo: "bg-[#7c3aed] text-white",
} as const;
export type AvatarColor = keyof typeof AVATAR_COLORS;

export const NUDGES = ["Bora estudar! 📚", "Não perde a sequência! 🔥", "Tô estudando, vem junto! ⚓", "Você consegue! 💪", "Só 10 minutinhos hoje? ⏱️"] as const;
export const REACTIONS = ["🔥", "👏", "💪", "🎉", "🧠"] as const;

/** Nível n precisa de 50·n·(n+1) XP no total (100, 300, 600, 1000…). Mesmo cálculo do banco (_level). */
export function levelInfo(total: number) {
  const level = Math.max(1, Math.floor((-1 + Math.sqrt(1 + (8 * total) / 100)) / 2) + 1);
  const start = 50 * (level - 1) * level;
  const next = 50 * level * (level + 1);
  return { level, into: total - start, need: next - start, pct: Math.min(100, ((total - start) / (next - start)) * 100) };
}

/** Frase do mural para cada tipo de atividade. */
export function describeEvent(e: FeedEvent): string {
  const p = e.payload as Record<string, string | number>;
  switch (e.kind) {
    case "simulado": return `terminou "${p.title}" com ${p.correct}/${p.total} acertos`;
    case "triagem": return `fez a triagem: ${p.correct}/${p.total} acertos`;
    case "redacao": return "recebeu a correção de uma redação";
    case "nivel": return `subiu para o nível ${p.level} ⭐`;
    case "sequencia": return `chegou a ${p.days} dias seguidos 🔥`;
    case "liga": return `subiu para a divisão ${TIERS[Number(p.tier)]?.name ?? ""} ${TIERS[Number(p.tier)]?.emoji ?? ""}`;
    case "tripulacao": return `entrou na tripulação ${p.emoji ?? ""} ${p.crew}`;
  }
}

/** Mensagens de erro das RPCs para o usuário. */
export const SOCIAL_ERRORS: Record<string, string> = {
  username_invalid: "Use de 3 a 20 letras minúsculas, números, ponto ou _.",
  username_reserved: "Esse apelido é reservado. Escolha outro.",
  username_taken: "Esse @apelido já tem dono. Tente outro.",
  avatar_invalid: "Avatar inválido.",
  user_not_found: "Não encontramos esse @apelido.",
  too_many_requests: "Você tem muitos pedidos pendentes. Espere alguém aceitar.",
  invalid_action: "Ação inválida.",
  not_allowed: "Só dá para fazer isso com amigos ou colegas de tripulação.",
  boost_used_today: "Você já mandou esse boost hoje. Amanhã tem mais!",
  message_invalid: "Mensagem inválida.",
  too_many_crews: "Você já está em 3 tripulações (o máximo).",
  crew_not_found: "Código de tripulação não encontrado.",
  crew_full: "Essa tripulação já tem 12 pessoas.",
  not_found: "Não encontrado.",
};
export const socialError = (msg: string) => SOCIAL_ERRORS[Object.keys(SOCIAL_ERRORS).find((k) => msg.includes(k)) ?? ""] ?? "Não foi possível agora. Tente de novo.";

/** Hora atual (fora do render: a regra de pureza do React não aceita Date.now() direto no componente). */
export const nowMs = () => Date.now();
