import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiError, generateJson } from "@/lib/ai/gemini";
import { enemPrompt, ufprPrompt, discursivePrompt } from "@/lib/ai/prompts";
import { checkDiscursiveIds, checkUfprAgainstRubric, enemCorrectionSchema, keepRealQuotes, ufprCorrectionSchema } from "@/lib/ai/schemas";
import { estimateLines, lineStatus, wordCount } from "@/lib/essay/lines";

const enemOk = () => ({
  annulled: { value: false, reason: null },
  competencies: ["c1", "c2", "c3", "c4", "c5"].map((key) => ({ key, score: 160, justification: "Justificativa suficiente." })),
  highlights: [{ quote: "texto", comment: "bom", criterion: "c1", type: "acerto" }],
  suggestions: ["Revise os conectivos."],
  intervention: Object.fromEntries(["agent", "action", "means", "purpose", "detail"].map((k) => [k, { present: true, quote: "x" }])),
  summary: "Boa redação no geral.",
});
const reply = (obj: unknown, status = 200) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: typeof obj === "string" ? obj : JSON.stringify(obj) }] } }] }), { status });

describe("generateJson (validação + 1 nova tentativa)", () => {
  beforeEach(() => { process.env.GEMINI_API_KEY = "test-key"; process.env.GEMINI_MODEL = "modelo-teste"; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.GEMINI_API_KEY; });

  it("aceita na primeira e envia a chave só no cabeçalho", async () => {
    const f = vi.fn(async () => reply(enemOk()));
    vi.stubGlobal("fetch", f);
    const r = await generateJson({ system: "s", parts: [{ text: "u" }], schema: enemCorrectionSchema });
    expect(r.tries).toBe(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/models/modelo-teste:generateContent");
    expect(url).not.toContain("test-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
  });

  it("nota fora dos degraus (150) → tenta de novo dizendo o erro → aceita a segunda", async () => {
    const bad = enemOk();
    bad.competencies[0].score = 150;
    const f = vi.fn().mockResolvedValueOnce(reply(bad)).mockResolvedValueOnce(reply(enemOk()));
    vi.stubGlobal("fetch", f);
    const r = await generateJson({ system: "s", parts: [{ text: "u" }], schema: enemCorrectionSchema });
    expect(r.tries).toBe(2);
    const body2 = JSON.parse((f.mock.calls[1] as unknown as [string, RequestInit])[1].body as string);
    expect(JSON.stringify(body2)).toContain("rejeitada pela validação");
  });

  it("falha duas vezes → AiError (não grava lixo)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply("isso não é json")));
    await expect(generateJson({ system: "s", parts: [{ text: "u" }], schema: enemCorrectionSchema })).rejects.toThrow(/2 tentativas/);
  });

  it("aceita JSON dentro de bloco ```json", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply("```json\n" + JSON.stringify(enemOk()) + "\n```")));
    await expect(generateJson({ system: "s", parts: [{ text: "u" }], schema: enemCorrectionSchema })).resolves.toBeTruthy();
  });

  it("429 vira mensagem amigável de cota; sem chave avisa que não está configurado", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    await expect(generateJson({ system: "s", parts: [{ text: "u" }], schema: enemCorrectionSchema })).rejects.toThrow(/cota gratuita/);
    delete process.env.GEMINI_API_KEY;
    await expect(generateJson({ system: "s", parts: [{ text: "u" }], schema: enemCorrectionSchema })).rejects.toBeInstanceOf(AiError);
  });

  it("checagem extra (rubrica) também força nova tentativa", async () => {
    const base = { annulled: { value: false }, highlights: [], suggestions: [], summary: "Resumo da correção." };
    const wrong = { ...base, criteria: [{ key: "comando", score: 99, justification: "ok ok" }] };
    const right = { ...base, criteria: [{ key: "comando", score: 5, justification: "ok ok" }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply(wrong)).mockResolvedValueOnce(reply(right)));
    const r = await generateJson({ system: "s", parts: [{ text: "u" }], schema: ufprCorrectionSchema, extraCheck: (v) => checkUfprAgainstRubric(v, [{ key: "comando", max: 0.25 }], 25) });
    expect(r.value.criteria[0].score).toBe(5);
  });
});

describe("schemas e checagens", () => {
  it("ENEM exige as 5 competências, sem repetir", () => {
    const x = enemOk();
    x.competencies[4].key = "c1";
    expect(enemCorrectionSchema.safeParse(x).success).toBe(false);
  });
  it("UFPR: critérios devem bater com a rubrica e respeitar o máximo", () => {
    const v = { annulled: { value: false }, criteria: [{ key: "a", score: 3, justification: "x x x" }], highlights: [], suggestions: [], summary: "resumo bom" } as never;
    expect(checkUfprAgainstRubric(v, [{ key: "a", max: 0.2 }, { key: "b", max: 0.8 }], 10)).toMatch(/esperados/);
    expect(checkUfprAgainstRubric(v, [{ key: "a", max: 0.2 }], 10)).toMatch(/acima do máximo/);
    expect(checkUfprAgainstRubric(v, [{ key: "a", max: 0.3 }], 10)).toBeNull();
  });
  it("discursivas: ids e máximos conferidos", () => {
    const b = { items: [{ id: "1", score: 4, max: 5, found: [], missing: [], feedback: "certo" }] };
    expect(checkDiscursiveIds(b, ["1"], { "1": 5 })).toBeNull();
    expect(checkDiscursiveIds(b, ["1", "2"], { "1": 5 })).toMatch(/IDs/);
    expect(checkDiscursiveIds(b, ["1"], { "1": 3 })).toMatch(/acima/);
  });
  it("descarta destaques que citam trechos inexistentes", () => {
    const t = "O Brasil  envelhece\nrapidamente.";
    expect(keepRealQuotes([{ quote: "Brasil envelhece rapidamente" }, { quote: "inventado" }], t)).toEqual([{ quote: "Brasil envelhece rapidamente" }]);
  });
});

describe("prompts", () => {
  const theme = { kind: "ufpr" as const, title: "T", prompt_md: "Resuma.", support_texts_md: "Apoio.", task_type: "resumo", genre: null, line_limit: 5, min_lines: 0, max_score: 15, official_mirror_md: "Espelho X" };
  const rubric = { criteria: [{ key: "comando", name: "Comando", description: "d", max: 0.25 }], instructions: "regras" };
  it("UFPR traz limite, máximo por critério em pontos e o espelho", () => {
    const p = ufprPrompt(theme, rubric, "linha\n".repeat(7));
    expect(p.system).toContain("máx. 3.75");
    expect(p.system).toContain("ESPELHO OFICIAL");
    expect(p.user).toContain("PASSOU DO LIMITE");
    expect(p.user).toContain("Espelho X");
  });
  it("ENEM traz as 5 competências e o tema", () => {
    const p = enemPrompt({ ...theme, kind: "enem", title: "Envelhecimento" }, { criteria: [1, 2, 3, 4, 5].map((i) => ({ key: `c${i}`, name: `C${i}`, description: "d", max: 200, step: 40 })), instructions: "r" }, "texto");
    expect(p.system.match(/- c\d/g)).toHaveLength(5);
    expect(p.user).toContain("Envelhecimento");
  });
  it("discursivas em lote numeradas", () => {
    const p = discursivePrompt([{ id: "1", statement: "E", mirror: null, max: 5, answer: "A" }, { id: "2", statement: "E2", mirror: "M", max: 3, answer: "B" }], "");
    expect(p.user).toContain("### ITEM 1 (máx. 5)");
    expect(p.user).toContain("(sem espelho)");
  });
});

describe("linhas da folha", () => {
  it("parágrafo curto = 1 linha; longo quebra a cada ~75 caracteres; linhas vazias não contam", () => {
    expect(estimateLines("Oi.")).toBe(1);
    expect(estimateLines("a".repeat(151))).toBe(3);
    expect(estimateLines("Um.\n\n\nDois.")).toBe(2);
    expect(estimateLines("")).toBe(0);
  });
  it("status de limite e mínimo (ENEM: até 7 linhas zera)", () => {
    expect(lineStatus(31, 30)).toBe("over");
    expect(lineStatus(7, 30, 8)).toBe("short");
    expect(lineStatus(20, 30, 8)).toBe("ok");
    expect(wordCount("  duas   palavras ")).toBe(2);
  });
});
