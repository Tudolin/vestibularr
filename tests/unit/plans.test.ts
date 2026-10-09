import { describe, expect, it } from "vitest";
import { brl, describeLimit, PLANS } from "@/lib/plans";

describe("planos (vitrine)", () => {
  it("descreve limites", () => {
    expect(describeLimit({ period: "week", quota: 3 })).toBe("3 por semana");
    expect(describeLimit({ period: "day", quota: 40 }, "mensagens")).toBe("40 mensagens por dia");
    expect(describeLimit({ period: "month", quota: null })).toBe("ilimitado");
    expect(describeLimit({ period: "month", quota: 0 })).toBe("—");
  });
  it("preços em reais e ordem crescente", () => {
    expect(brl(990).replace(/\s/g, " ")).toBe("R$ 9,90");
    const prices = PLANS.map((p) => p.priceCents);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });
  it("Grátis tem 5 exportações por mês de até 20 questões", () => {
    const free = PLANS.find((p) => p.code === "free")!;
    expect(free.limits.export).toEqual({ period: "month", quota: 5 });
    expect(free.limits.export_size.quota).toBe(20);
  });
});
