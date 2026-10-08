import { describe, expect, it } from "vitest";
import { estimateArea, estimateEnem, sisuWeighted, DEFAULT_BANDS } from "@/lib/scoring/enem";
import { groupBy, totals, type Row } from "@/lib/scoring/aggregate";
import { specificWeight, ufprScore, UFPR_2027_SUBJECTS, UFPR_CPT_MAX } from "@/lib/scoring/ufpr";

describe("UFPR 2027 — pesos (edital 6.7.3)", () => {
  it.each([[1, 3], [5, 3], [6, 2.5], [10, 2.5], [11, 2], [16, 2]])("%i questões específicas → peso %s", (n, w) => {
    expect(specificWeight(n)).toBe(w);
  });
  it("sem disciplina específica o peso é 1", () => expect(specificWeight(0)).toBe(1));
});

describe("UFPR 2027 — nota milesimal (edital 9.9)", () => {
  const all = (k: number) => Object.fromEntries(Object.entries(UFPR_2027_SUBJECTS).map(([s, t]) => [s, { correct: Math.round(t * k), total: t }]));

  it("gabaritar tudo (objetiva + CPT) = 1000; zerar = 0", () => {
    expect(ufprScore({ bySubject: all(1), discursive: 40, includeDiscursive: true }).score).toBe(1000);
    expect(ufprScore({ bySubject: all(0), discursive: 0, includeDiscursive: true }).score).toBe(0);
  });

  it("denominador: 80 objetivas + 40 da discursiva", () => {
    const r = ufprScore({ bySubject: all(1), discursive: 0, includeDiscursive: true });
    expect(r.max).toBe(120);
    expect(r.score).toBeCloseTo((80 / 120) * 1000, 3);
  });

  it("peso diferenciado: Matemática + Física (16 questões) → peso 2", () => {
    const by = all(0.5); // 50% de acerto em tudo
    by["Matemática"] = { correct: 8, total: 8 };
    by["Física"] = { correct: 0, total: 8 };
    const r = ufprScore({ bySubject: by, specificSubjects: ["Matemática", "Física"], discursive: 0, includeDiscursive: false });
    expect(r.weight).toBe(2);
    // objetiva sem pesos: 80 questões; com peso 2 em 16 → max = 64 + 32 = 96
    expect(r.objectiveMax).toBe(96);
  });

  it("peso 3 quando a(s) específica(s) somam até 5 questões", () => {
    const r = ufprScore({
      bySubject: { Filosofia: { correct: 5, total: 5 }, Biologia: { correct: 0, total: 8 } },
      specificSubjects: ["Filosofia"],
    });
    expect(r.weight).toBe(3);
    expect(r.objectiveWeighted).toBe(15);
    expect(r.objectiveMax).toBe(15 + 8);
  });

  it("limita a 2 disciplinas específicas e a discursiva a 40", () => {
    const r = ufprScore({
      bySubject: { A: { correct: 1, total: 1 }, B: { correct: 1, total: 1 }, C: { correct: 1, total: 1 } },
      specificSubjects: ["A", "B", "C"],
      discursive: 999,
      includeDiscursive: true,
    });
    expect(r.objectiveMax).toBe(3 * 1 + 2 * (r.weight - 1) /* só A e B ponderadas */);
    expect(r.score).toBeLessThanOrEqual(1000);
  });

  it("a distribuição oficial soma 80 questões", () => {
    expect(Object.values(UFPR_2027_SUBJECTS).reduce((a, b) => a + b, 0)).toBe(80);
    expect(UFPR_CPT_MAX).toBe(40);
  });

  it("arredonda para 3 casas", () => {
    const r = ufprScore({ bySubject: { X: { correct: 1, total: 3 } } });
    expect(r.score).toBe(333.333);
  });

  it("sem questões não divide por zero", () => expect(ufprScore({ bySubject: {} }).score).toBe(0));
});

describe("ENEM — estimativa por área (aproximação linear)", () => {
  it("extremos e meio da faixa", () => {
    expect(estimateArea(0, 45, [300, 800])).toBe(300);
    expect(estimateArea(45, 45, [300, 800])).toBe(800);
    expect(estimateArea(22, 44, [300, 800])).toBe(550);
  });
  it("sem questões na área → null (não inventa nota)", () => expect(estimateArea(0, 0, [300, 800])).toBeNull());
  it("média só das áreas que existem", () => {
    const r = estimateEnem({ matematica: { correct: 45, total: 45 }, linguagens: { correct: 0, total: 45 } });
    expect(r.areas.matematica).toBe(DEFAULT_BANDS.matematica[1]);
    expect(r.areas.humanas).toBeUndefined();
    expect(r.average).toBe(Math.round((DEFAULT_BANDS.matematica[1] + DEFAULT_BANDS.linguagens[0]) / 2));
  });
});

describe("Sisu — nota ponderada", () => {
  const w = { linguagens: 1, humanas: 1, natureza: 2, matematica: 3, redacao: 3 };
  it("média ponderada", () => {
    const s = { linguagens: 600, humanas: 600, natureza: 700, matematica: 800, redacao: 900 };
    expect(sisuWeighted(s, w)).toBe(Math.round(((600 + 600 + 1400 + 2400 + 2700) / 10) * 100) / 100);
  });
  it("sem redação (ou qualquer nota) não calcula", () => {
    expect(sisuWeighted({ linguagens: 600, humanas: 600, natureza: 700, matematica: 800 }, w)).toBeNull();
  });
});

describe("agregação de desempenho", () => {
  const row = (o: Partial<Row>): Row => ({ question_id: Math.random().toString(), area: "matematica", subject: "Matemática", topic: "Funções", kind: "objective", choice: "A", correct: "A", time_spent_ms: 1000, ...o });
  const rows = [row({}), row({ choice: "B" }), row({ choice: null }), row({ area: "humanas", topic: null }), row({ kind: "discursive", choice: null, correct: null })];
  it("totais ignoram discursivas e distinguem erro de branco", () => {
    expect(totals(rows)).toEqual({ total: 4, correct: 2, blank: 1, wrong: 1, pct: 50 });
  });
  it("agrupa por área e por assunto (null vira 'Sem classificação')", () => {
    const byArea = groupBy(rows, (r) => r.area);
    expect(byArea.find((b) => b.key === "matematica")).toMatchObject({ total: 3, correct: 1, wrong: 1, blank: 1, pct: 33 });
    expect(groupBy(rows, (r) => r.topic).map((b) => b.key)).toContain("Sem classificação");
  });
});
