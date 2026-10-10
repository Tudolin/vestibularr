import { describe, expect, it } from "vitest";
import { DEFAULT_TOOLS, fmtClock, nextPhase, phaseMs, readTools } from "@/lib/study-tools";

describe("pomodoro", () => {
  it("alterna foco e pausas; a longa vem depois de N focos e zera o ciclo", () => {
    const t = { ...DEFAULT_TOOLS, cycles: 3 };
    let s = { phase: "focus" as const, done: 0 } as ReturnType<typeof nextPhase>;
    const seq: string[] = [];
    for (let i = 0; i < 7; i++) { s = nextPhase(s.phase, s.done, t); seq.push(s.phase); }
    expect(seq).toEqual(["short", "focus", "short", "focus", "long", "focus", "short"]);
  });

  it("durações em ms e relógio", () => {
    expect(phaseMs("focus", DEFAULT_TOOLS)).toBe(25 * 60_000);
    expect(phaseMs("long", { ...DEFAULT_TOOLS, longMin: 20 })).toBe(20 * 60_000);
    expect(fmtClock(25 * 60_000)).toBe("25:00");
    expect(fmtClock(61_001)).toBe("01:02"); // arredonda para cima: nunca mostra 00:00 antes da hora
    expect(fmtClock(-5)).toBe("00:00");
  });

  it("ajustes do perfil: completa com padrões e descarta valores inválidos", () => {
    expect(readTools(undefined)).toEqual(DEFAULT_TOOLS);
    expect(readTools({ focusMin: 50, side: "left" })).toMatchObject({ focusMin: 50, side: "left", shortMin: 5 });
    expect(readTools({ focusMin: 9999 })).toEqual(DEFAULT_TOOLS);
    expect(readTools("lixo")).toEqual(DEFAULT_TOOLS);
  });
});
