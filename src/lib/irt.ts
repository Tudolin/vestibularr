/**
 * TRI (modelo logístico de 3 parâmetros), com os parâmetros oficiais dos microdados do INEP.
 * A habilidade θ é estimada por EAP (média a posteriori) numa grade, com priori normal.
 * Escala do ENEM: nota = 500 + 100·θ (θ = 0 é a média de referência do INEP).
 */
export type Item = { a: number; b: number; c: number };
export type Response = Item & { ok: boolean };

/** Probabilidade de acerto no 3PL. */
export function p3pl(theta: number, { a, b, c }: Item): number {
  return c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
}

const GRID = Array.from({ length: 121 }, (_, i) => -4 + i * (8 / 120)); // θ de −4 a 4

/** EAP de θ e seu erro-padrão (desvio a posteriori). Sem respostas, devolve a própria priori. */
export function eap(responses: Response[], prior: { mean: number; sd: number } = { mean: 0, sd: 1 }): { theta: number; se: number } {
  let wsum = 0;
  let m1 = 0;
  let m2 = 0;
  // log-verossimilhança em escala log para não estourar com muitas respostas
  const logs = GRID.map((t) => {
    let l = -0.5 * ((t - prior.mean) / prior.sd) ** 2;
    for (const r of responses) {
      const p = Math.min(Math.max(p3pl(t, r), 1e-9), 1 - 1e-9);
      l += r.ok ? Math.log(p) : Math.log(1 - p);
    }
    return l;
  });
  const max = Math.max(...logs);
  GRID.forEach((t, i) => {
    const w = Math.exp(logs[i] - max);
    wsum += w;
    m1 += w * t;
    m2 += w * t * t;
  });
  const theta = m1 / wsum;
  return { theta, se: Math.sqrt(Math.max(m2 / wsum - theta * theta, 0)) };
}

export const toEnemScore = (theta: number) => Math.round(500 + 100 * theta);

/** Item "médio" para questões sem parâmetros oficiais (UFPR, provas antigas): dificuldade média, 5 alternativas. */
export const DEFAULT_ITEM: Item = { a: 1.5, b: 0.5, c: 0.2 };
