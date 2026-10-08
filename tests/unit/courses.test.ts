import { describe, expect, it } from "vitest";
import { distanceToCutoff, officialSubject, sisuCourseEstimate, ufprCourseEstimate } from "@/lib/scoring/courses";

describe("nomes de disciplina", () => {
  it.each([["Português", "Língua Portuguesa"], ["LITERATURA", "Literatura Brasileira"], ["Inglês", "Língua Estrangeira Moderna"], ["matemática básica", "Matemática"], ["Química Orgânica", "Química"], ["Artes", null]])("%s → %s", (a, b) => {
    expect(officialSubject(a)).toBe(b);
  });
});

describe("estimativa UFPR por curso", () => {
  const all = (pct: number) => ["Língua Portuguesa", "Biologia", "Física", "Geografia", "História", "Matemática", "Química", "Inglês", "Literatura", "Filosofia", "Sociologia"].map((key) => ({ key, answered: 100, correct: pct }));
  it("100% em tudo e CPT 100% = 1000, com ou sem pesos", () => {
    expect(ufprCourseEstimate(all(100), [], 100)?.score).toBe(1000);
    expect(ufprCourseEstimate(all(100), [{ subject: "Matemática", weight: 2.5 }], 100)?.score).toBe(1000);
  });
  it("o peso do curso puxa a nota para as disciplinas específicas", () => {
    const st = all(50).map((s) => (s.key === "Matemática" ? { ...s, correct: 100 } : s));
    const sem = ufprCourseEstimate(st, [], 50)!.score;
    const com = ufprCourseEstimate(st, [{ subject: "Matemática", weight: 2.5 }], 50)!;
    expect(com.weight).toBe(2.5);
    expect(com.score).toBeGreaterThan(sem);
  });
  it("disciplinas sem dados usam a média e isso é informado; sem dado nenhum → null", () => {
    const r = ufprCourseEstimate([{ key: "Matemática", answered: 10, correct: 5 }], [], null)!;
    expect(r.filledWithAverage).toHaveLength(10);
    expect(r.cptMissing).toBe(true);
    expect(ufprCourseEstimate([], [], 50)).toBeNull();
  });
});

describe("Sisu por curso", () => {
  const w = { linguagens: 1, humanas: 1, natureza: 1, matematica: 1, redacao: 1 };
  it("sem redação não calcula e diz o que falta", () => {
    const r = sisuCourseEstimate([{ key: "matematica", answered: 10, correct: 10 }], null, w);
    expect(r.score).toBeNull();
    expect(r.missing).toEqual(["linguagens", "humanas", "natureza", "redacao"]);
  });
  it("com tudo calcula a média ponderada e a distância ao corte", () => {
    const by = ["linguagens", "humanas", "natureza", "matematica"].map((key) => ({ key, answered: 10, correct: 5 }));
    const r = sisuCourseEstimate(by, 800, w);
    expect(r.score).toBeGreaterThan(500);
    expect(distanceToCutoff(r.score, 700)).toBeCloseTo(r.score! - 700, 2);
    expect(distanceToCutoff(null, 700)).toBeNull();
  });
});
