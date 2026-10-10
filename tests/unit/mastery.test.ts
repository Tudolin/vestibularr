import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { eap, p3pl, toEnemScore } from "@/lib/irt";
import { computeMastery, rankTopics, type Fact } from "@/lib/mastery";

const item = { a: 2, b: 0.5, c: 0.2 };

describe("TRI 3PL / EAP", () => {
  it("probabilidade: no θ = b fica no meio entre o chute e 1", () => {
    expect(p3pl(0.5, item)).toBeCloseTo(0.2 + 0.8 / 2, 10);
    expect(p3pl(-10, item)).toBeCloseTo(0.2, 3);
    expect(p3pl(10, item)).toBeCloseTo(1, 3);
  });

  it("sem respostas devolve a priori; acertar mais sobe θ; mais respostas reduzem a incerteza", () => {
    expect(eap([]).theta).toBeCloseTo(0, 2);
    const few = eap([{ ...item, ok: true }]);
    const many = eap(Array.from({ length: 20 }, () => ({ ...item, ok: true })));
    expect(many.theta).toBeGreaterThan(few.theta);
    expect(many.se).toBeLessThan(few.se);
    expect(eap([{ ...item, ok: false }]).theta).toBeLessThan(0);
  });

  it("acertar uma difícil vale mais que acertar uma fácil (é a TRI, não a contagem)", () => {
    const easy = { a: 2, b: -1, c: 0.2 }, hard = { a: 2, b: 2, c: 0.2 };
    const rightHard = eap([{ ...hard, ok: true }, { ...easy, ok: false }]).theta;
    const rightEasy = eap([{ ...easy, ok: true }, { ...hard, ok: false }]).theta;
    // incoerente (acertou a difícil e errou a fácil) pesa menos que o padrão coerente
    expect(rightEasy).toBeGreaterThan(rightHard);
  });

  it("com os parâmetros oficiais do ENEM 2023 (Matemática), notas extremas ficam em faixas plausíveis", () => {
    const inep = JSON.parse(readFileSync(join(__dirname, "../../data/inep/enem-2023.json"), "utf8")) as { items: { area: string; irt: { a: number; b: number; c: number } | null }[] };
    const mt = inep.items.filter((i) => i.area === "MT" && i.irt).map((i) => i.irt!);
    expect(mt.length).toBeGreaterThan(40);
    const all = toEnemScore(eap(mt.map((p) => ({ ...p, ok: true }))).theta);
    const none = toEnemScore(eap(mt.map((p) => ({ ...p, ok: false }))).theta);
    expect(all).toBeGreaterThan(800);
    expect(none).toBeLessThan(420);
  });
});

describe("domínio por assunto", () => {
  const f = (topic: string, ok: boolean, b = 0.5): Fact => ({ board: "ENEM", area: "matematica", subject: "Matemática", topic, irt_a: 2, irt_b: b, irt_c: 0.2, ok });
  const facts = [
    ...Array.from({ length: 8 }, () => f("Estatística", true)),
    ...Array.from({ length: 8 }, () => f("Geometria espacial", false)),
    ...Array.from({ length: 4 }, (_, i) => f("Funções", i < 2)),
  ];

  it("calcula área e assuntos; o assunto forte fica acima do fraco", () => {
    const m = computeMastery(facts);
    expect(m.areas).toHaveLength(1);
    expect(m.areas[0]).toMatchObject({ area: "matematica", n: 20, correct: 10, official: 20 });
    const by = Object.fromEntries(m.topics.map((t) => [t.topic, t]));
    expect(by["Estatística"].score).toBeGreaterThan(by["Funções"].score);
    expect(by["Funções"].score).toBeGreaterThan(by["Geometria espacial"].score);
  });

  it("onde focar pondera pelo peso do assunto na prova", () => {
    const m = computeMastery(facts);
    const { strengths, focus } = rankTopics(m.topics, [
      { subject: "Matemática", topic: "Estatística", n: 20 },
      { subject: "Matemática", topic: "Geometria espacial", n: 30 },
      { subject: "Matemática", topic: "Funções", n: 2 },
    ]);
    expect(strengths[0].topic).toBe("Estatística");
    expect(focus[0].topic).toBe("Geometria espacial");
    expect(focus.map((t) => t.topic)).not.toContain("Estatística");
  });

  it("questões sem parâmetros (UFPR) usam um item médio e não contam como oficiais", () => {
    const m = computeMastery([{ ...f("Funções", true), irt_a: null, irt_b: null, irt_c: null }]);
    expect(m.areas[0].official).toBe(0);
  });
});
