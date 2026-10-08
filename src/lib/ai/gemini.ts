import "server-only";
import type { z } from "zod";

/**
 * Cliente mínimo da Gemini API (REST), só no servidor. A chave nunca vai ao navegador.
 * - GEMINI_API_KEY: obrigatória para usar IA.
 * - GEMINI_MODEL: modelo (padrão: alias do Flash-Lite mais recente, o mais barato do plano gratuito).
 * - GEMINI_API_BASE: só para testes (servidor falso).
 */
export const DEFAULT_MODEL = "gemini-flash-lite-latest";
export const aiConfigured = () => !!process.env.GEMINI_API_KEY;
export const aiModel = () => process.env.GEMINI_MODEL || DEFAULT_MODEL;

export class AiError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
  }
}

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function call(system: string, parts: Part[], timeoutMs: number): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiError("A correção por IA ainda não está configurada (falta GEMINI_API_KEY).");
  const base = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/v1beta/models/${encodeURIComponent(aiModel())}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      signal: ctrl.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    });
    if (res.status === 429) throw new AiError("Limite da cota gratuita do Gemini atingido. Tente mais tarde.", true);
    if (!res.ok) throw new AiError(`Gemini respondeu ${res.status}`, res.status >= 500);
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new AiError(`Resposta vazia do modelo (${json.candidates?.[0]?.finishReason ?? "sem motivo"})`, true);
    return text;
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError((e as Error).name === "AbortError" ? "O modelo demorou demais para responder." : "Falha de rede ao chamar o Gemini.", true);
  } finally {
    clearTimeout(t);
  }
}

function parseJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  return JSON.parse(cleaned);
}

/**
 * Pede JSON e valida com Zod (+ checagem extra opcional). Se falhar, tenta UMA vez de novo,
 * mostrando ao modelo exatamente o erro. Se falhar de novo, lança AiError.
 */
export async function generateJson<S extends z.ZodTypeAny>(opts: {
  system: string;
  parts: Part[];
  schema: S;
  extraCheck?: (v: z.infer<S>) => string | null;
  timeoutMs?: number;
}): Promise<{ value: z.infer<S>; model: string; tries: number }> {
  let parts = opts.parts;
  let lastErr = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const raw = await call(opts.system, parts, opts.timeoutMs ?? 45_000);
    let candidate: unknown;
    try {
      candidate = parseJson(raw);
    } catch {
      lastErr = "a resposta não era JSON válido";
    }
    if (candidate !== undefined) {
      const res = opts.schema.safeParse(candidate);
      if (res.success) {
        const extra = opts.extraCheck?.(res.data) ?? null;
        if (!extra) return { value: res.data, model: aiModel(), tries: attempt };
        lastErr = extra;
      } else {
        lastErr = res.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      }
    }
    parts = [...opts.parts, { text: `\n\nATENÇÃO: sua resposta anterior foi rejeitada pela validação (${lastErr}). Responda de novo SOMENTE com JSON válido no formato pedido.` }];
  }
  throw new AiError(`A IA não devolveu uma correção válida após 2 tentativas: ${lastErr}`);
}
