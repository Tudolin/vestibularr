/**
 * Domínio por área e por assunto a partir das respostas do aluno (RPC answer_facts).
 *
 * - Área: θ por EAP com os parâmetros TRI oficiais (questões sem parâmetros usam um item médio).
 * - Assunto: EAP só com as respostas do assunto, com a priori centrada no θ da área (encolhimento):
 *   com poucas respostas o assunto fica perto da média da área; com muitas, fala por si.
 * - "Onde focar": peso do assunto na prova × chance de errar uma questão típica dele.
 */
import { DEFAULT_ITEM, eap, p3pl, toEnemScore, type Response } from "@/lib/irt";
import { AREAS, type Area } from "@/lib/scoring/enem";

export type Fact = {
  board: string;
  area: string | null;
  subject: string | null;
  topic: string | null;
  irt_a: number | null;
  irt_b: number | null;
  irt_c: number | null;
  ok: boolean;
};

export type AreaMastery = { area: Area; n: number; correct: number; theta: number; se: number; score: number; official: number };
export type TopicMastery = {
  area: Area;
  subject: string;
  topic: string;
  n: number;
  correct: number;
  theta: number;
  se: number;
  score: number;
  /** Chance de acertar uma questão típica do assunto (0–1). */
  pCorrect: number;
};
/** Quantas questões de cada assunto existem no banco (peso do assunto na prova). */
export type TopicWeight = { subject: string; topic: string; n: number };

const toResponse = (f: Fact): Response =>
  f.irt_a != null && f.irt_b != null && f.irt_c != null ? { a: f.irt_a, b: f.irt_b, c: f.irt_c, ok: f.ok } : { ...DEFAULT_ITEM, ok: f.ok };
const isArea = (a: string | null): a is Area => !!a && (AREAS as string[]).includes(a);

export function computeMastery(facts: Fact[]) {
  const areas: AreaMastery[] = [];
  const topics: TopicMastery[] = [];
  for (const area of AREAS) {
    const fa = facts.filter((f) => f.area === area);
    if (!fa.length) continue;
    const { theta, se } = eap(fa.map(toResponse));
    areas.push({
      area,
      n: fa.length,
      correct: fa.filter((f) => f.ok).length,
      theta,
      se,
      score: toEnemScore(theta),
      official: fa.filter((f) => f.irt_b != null).length,
    });

    const byTopic = new Map<string, Fact[]>();
    for (const f of fa) {
      if (!f.topic || !f.subject) continue;
      const k = `${f.subject}\u0000${f.topic}`;
      byTopic.set(k, [...(byTopic.get(k) ?? []), f]);
    }
    for (const [k, ft] of byTopic) {
      const [subject, topic] = k.split("\u0000");
      const rs = ft.map(toResponse);
      const t = eap(rs, { mean: theta, sd: 0.8 });
      const typical = rs.reduce((s, r) => s + p3pl(t.theta, r), 0) / rs.length;
      topics.push({ area, subject, topic, n: ft.length, correct: ft.filter((f) => f.ok).length, theta: t.theta, se: t.se, score: toEnemScore(t.theta), pCorrect: typical });
    }
  }
  return { areas, topics };
}

/** Assuntos mais fortes (só com dados suficientes) e onde focar (maior ganho esperado). */
export function rankTopics(topics: TopicMastery[], weights: TopicWeight[], { minAnswers = 3, limit = 5 } = {}) {
  const total = weights.reduce((s, w) => s + w.n, 0) || 1;
  const weightOf = (t: TopicMastery) => (weights.find((w) => w.subject === t.subject && w.topic === t.topic)?.n ?? 1) / total;
  const enough = topics.filter((t) => t.n >= minAnswers && isArea(t.area));
  // forte = acerta a maioria das questões típicas do assunto; um assunto nunca aparece nas duas listas
  const strengths = enough.filter((t) => t.pCorrect >= 0.6).sort((a, b) => b.score - a.score || b.n - a.n).slice(0, limit);
  const strong = new Set(strengths.map((t) => `${t.subject}|${t.topic}`));
  const focus = enough
    .filter((t) => !strong.has(`${t.subject}|${t.topic}`))
    .map((t) => ({ ...t, weight: weightOf(t), gain: weightOf(t) * (1 - t.pCorrect) }))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, limit);
  return { strengths, focus };
}
