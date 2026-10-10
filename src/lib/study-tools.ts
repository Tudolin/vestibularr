import { z } from "zod";

/** Ajustes do painel de estudo (pomodoro, som ambiente…), salvos no perfil em preferences.study_tools. */
export const studyToolsSchema = z.object({
  focusMin: z.number().int().min(5).max(120),
  shortMin: z.number().int().min(1).max(30),
  longMin: z.number().int().min(5).max(60),
  cycles: z.number().int().min(2).max(8), // focos até a pausa longa
  autoStart: z.boolean(), // emenda a próxima etapa sozinho
  chime: z.boolean(), // som ao terminar uma etapa
  notify: z.boolean(), // notificação do navegador ao terminar
  noise: z.enum(["branco", "rosa", "marrom"]),
  volume: z.number().min(0).max(1),
  side: z.enum(["right", "left"]),
});
export type StudyTools = z.infer<typeof studyToolsSchema>;

export const DEFAULT_TOOLS: StudyTools = {
  focusMin: 25, shortMin: 5, longMin: 15, cycles: 4, autoStart: false, chime: true, notify: false,
  noise: "marrom", volume: 0.35, side: "right",
};

export const NOTES_MAX = 4000;

/** Mescla o que veio do perfil com os padrões, descartando valores inválidos (versões antigas, edição manual). */
export function readTools(raw: unknown): StudyTools {
  const merged = { ...DEFAULT_TOOLS, ...(raw && typeof raw === "object" ? raw : {}) };
  const parsed = studyToolsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_TOOLS;
}

export type Phase = "focus" | "short" | "long";
export const PHASE_LABEL: Record<Phase, string> = { focus: "Foco", short: "Pausa curta", long: "Pausa longa" };

export function phaseMs(phase: Phase, t: StudyTools) {
  return (phase === "focus" ? t.focusMin : phase === "short" ? t.shortMin : t.longMin) * 60_000;
}

/** Próxima etapa: depois de `cycles` focos vem a pausa longa. `done` = focos concluídos no ciclo atual. */
export function nextPhase(phase: Phase, done: number, t: StudyTools): { phase: Phase; done: number } {
  if (phase !== "focus") return { phase: "focus", done: phase === "long" ? 0 : done };
  const d = done + 1;
  return d >= t.cycles ? { phase: "long", done: d } : { phase: "short", done: d };
}

export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
