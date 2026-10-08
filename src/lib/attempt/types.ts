export type Label = "A" | "B" | "C" | "D" | "E";
export type AttemptMode = "simulado" | "custom" | "treino" | "revisao";
export type AttemptStatus = "in_progress" | "paused" | "finished" | "expired";

export type AnswerFields = {
  choice: Label | null;
  discursive_text: string | null;
  flagged: boolean;
  time_spent_ms: number;
  strikes: Label[];
  highlights: string[];
};
export type FieldName = keyof AnswerFields;

/** Estado local de uma resposta + o timestamp (ms) da última escrita de cada campo. */
export type LocalAnswer = AnswerFields & { field_ts: Partial<Record<FieldName, number>> };
export type AnswersMap = Record<string, LocalAnswer>;

export type Op =
  | { op_id: string; attempt_id: string; question_id: string; field: FieldName; value: unknown; ts: number }
  | { op_id: string; attempt_id: string; question_id: null; field: "current_index"; value: number; ts: number };

export type SyncResponse = {
  server_now: number;
  status: AttemptStatus;
  deadline_at: number | null;
  current_index: number;
  applied: string[];
  rejected: { op_id: string; reason: string }[];
};

export type SaveState = "saved" | "saving" | "offline";
