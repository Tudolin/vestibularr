import { describe, expect, it } from "vitest";
import { parseImportText } from "./parse";

const q = (over: Record<string, unknown> = {}) => ({
  number: 1,
  area: "matematica",
  statement_md: "Quanto é 2+2?",
  alternatives: [
    { label: "A", text_md: "3" },
    { label: "B", text_md: "4" },
  ],
  correct: "B",
  ...over,
});
const json = (o: unknown) => JSON.stringify(o);

describe("importação JSON", () => {
  it("aceita prova válida", () => {
    const r = parseImportText("a.json", json({ version: 1, board: "ENEM", exams: [{ name: "ENEM 2023 — Dia 2", year: 2023, questions: [q()] }] }));
    expect(r.issues).toEqual([]);
    expect(r.summary).toMatchObject({ exams: 1, questions: 1, invalid: 0 });
  });

  it("reporta gabarito fora das alternativas e segue com as válidas", () => {
    const r = parseImportText("a.json", json({ version: 1, board: "ENEM", questions: [q(), q({ number: 2, correct: "E" })] }));
    expect(r.summary).toMatchObject({ questions: 1, invalid: 1 });
    expect(r.issues[0].message).toMatch(/Gabarito E não existe/);
  });

  it("rejeita vestibular desconhecido e JSON quebrado", () => {
    expect(parseImportText("a.json", json({ board: "XYZ" })).bundle).toBeNull();
    expect(parseImportText("a.json", "{oops").issues[0].message).toMatch(/JSON inválido/);
  });

  it("detecta questão duplicada na mesma prova", () => {
    const r = parseImportText("a.json", json({ version: 1, board: "UFPR", exams: [{ name: "UFPR 2025", year: 2025, questions: [q(), q()] }] }));
    expect(r.summary.invalid).toBe(1);
    expect(r.issues[0].message).toMatch(/duplicada/);
  });

  it("idiomas diferentes com o mesmo número não são duplicata (ENEM LEM)", () => {
    const r = parseImportText("a.json", json({ version: 1, board: "ENEM", exams: [{ name: "ENEM 2023 — Dia 1", year: 2023, questions: [q({ language: "ingles" }), q({ language: "espanhol" })] }] }));
    expect(r.summary.invalid).toBe(0);
  });

  it("discursiva exige só enunciado e não aceita alternativas", () => {
    const ok = parseImportText("a.json", json({ version: 1, board: "UFPR", questions: [{ kind: "discursive", statement_md: "Explique.", official_mirror_md: "Espelho", max_score: 5 }] }));
    expect(ok.issues).toEqual([]);
    const bad = parseImportText("a.json", json({ version: 1, board: "UFPR", questions: [{ kind: "discursive", statement_md: "x", alternatives: [{ label: "A" }] }] }));
    expect(bad.summary.invalid).toBe(1);
  });

  it("bloqueia URLs que não são http(s)", () => {
    const r = parseImportText("a.json", json({ version: 1, board: "ENEM", questions: [q({ images: ["javascript:alert(1)"] })] }));
    expect(r.summary.invalid).toBe(1);
  });
});

describe("importação CSV", () => {
  const header = "board,exam_name,year,number,area,statement_md,A,B,C,D,E,correct,language,images";
  it("agrupa linhas por prova e lê alternativas", () => {
    const csv = [
      header,
      'UFPR,UFPR 2025,2025,1,matematica,"Enunciado, com vírgula",1,2,3,4,,C,,',
      'UFPR,UFPR 2025,2025,2,humanas,Outra,a,b,c,d,,a,,https://x.com/i.png|https://x.com/j.png',
      "UFPR,,,,linguagens,Avulsa,x,y,,,,B,,",
    ].join("\n");
    const r = parseImportText("a.csv", csv);
    expect(r.issues).toEqual([]);
    expect(r.bundle?.exams).toHaveLength(1);
    expect(r.bundle?.exams[0].questions).toHaveLength(2);
    expect(r.bundle?.exams[0].questions[0].alternatives).toHaveLength(4);
    expect(r.bundle?.exams[0].questions[1].images).toHaveLength(2);
    expect(r.bundle?.exams[0].questions[1].correct).toBe("A");
    expect(r.bundle?.questions).toHaveLength(1);
  });
});

import { chunkBundle } from "./chunk";
describe("chunkBundle", () => {
  it("divide por prova e por tamanho, sem perder questões", () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ number: i + 1, kind: "objective" as const, statement_md: "x", images: [], alternatives: [], correct: undefined })) as never[];
    const parts = chunkBundle({ version: 1, board: "ENEM", exams: [{ name: "A", year: 2020, questions: mk(250) }, { name: "B", year: 2021, questions: mk(10) }] as never, questions: mk(130) }, 100);
    expect(parts.map((p) => p.exams.reduce((n, e) => n + e.questions.length, 0) + p.questions.length)).toEqual([100, 100, 50, 10, 100, 30]);
    expect(parts.every((p) => p.exams.length <= 1)).toBe(true);
  });
});
