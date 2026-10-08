import { csvToRaw } from "./csv";
import { validateBundle, type ValidationResult } from "./schema";

export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

/** Interpreta o texto de um arquivo .json ou .csv e valida. Roda no cliente (prévia) e no servidor. */
export function parseImportText(filename: string, text: string): ValidationResult {
  const isCsv = /\.csv$/i.test(filename);
  try {
    if (isCsv) {
      const { raw, errors } = csvToRaw(text);
      const res = validateBundle(raw);
      return { ...res, issues: [...errors.map((message) => ({ where: "CSV", message })), ...res.issues] };
    }
    return validateBundle(JSON.parse(text));
  } catch (e) {
    return {
      bundle: null,
      issues: [{ where: "arquivo", message: e instanceof SyntaxError ? `JSON inválido: ${e.message}` : "Não foi possível ler o arquivo" }],
      summary: { exams: 0, questions: 0, invalid: 0, withoutKey: 0 },
    };
  }
}
