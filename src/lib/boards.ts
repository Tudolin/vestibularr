/** Bancas (vestibulares e concursos) e línguas estrangeiras: a única lista do app. */
export const BOARDS = ["ENEM", "UFPR", "FUVEST", "UNICAMP", "CONCURSO"] as const;
export type Board = (typeof BOARDS)[number];

export const BOARD_LABEL: Record<Board, string> = { ENEM: "ENEM", UFPR: "UFPR", FUVEST: "Fuvest", UNICAMP: "Unicamp", CONCURSO: "Concursos" };
export const BOARD_OPTIONS = BOARDS.map((b) => [b, BOARD_LABEL[b]] as [Board, string]);

export const isBoard = (v: unknown): v is Board => typeof v === "string" && (BOARDS as readonly string[]).includes(v);
export const parseBoard = (v: unknown): Board | null => (isBoard(v) ? v : null);

/** O ENEM tem inglês e espanhol; a UFPR tem as 7 (questões 83–90). */
export const LANGUAGES = ["ingles", "espanhol", "frances", "alemao", "italiano", "japones", "polones"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABEL: Record<Language, string> = {
  ingles: "Inglês",
  espanhol: "Espanhol",
  frances: "Francês",
  alemao: "Alemão",
  italiano: "Italiano",
  japones: "Japonês",
  polones: "Polonês",
};

export const languageLabel = (v: string | null | undefined) => (v ? LANGUAGE_LABEL[v as Language] ?? v : "");
