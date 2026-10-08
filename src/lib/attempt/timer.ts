/**
 * O relógio do cliente não é confiável: o servidor devolve `server_now` em cada resposta.
 * offset = server_now - Date.now() (menos metade da latência, se conhecida).
 * Tempo restante = deadline(servidor) - (Date.now() + offset).
 */
export function estimateOffset(serverNow: number, clientNowAtResponse: number, rttMs = 0) {
  return serverNow + rttMs / 2 - clientNowAtResponse;
}

export function remainingMs(deadlineAt: number | null, offset: number, clientNow = Date.now()) {
  if (deadlineAt == null) return null;
  return Math.max(0, deadlineAt - (clientNow + offset));
}

export function formatClock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/** Avisos aos 30 e 10 minutos finais (cada um dispara uma única vez). */
export const WARNING_MARKS_MS = [30 * 60_000, 10 * 60_000] as const;
export function crossedWarning(prevMs: number | null, nowMs: number | null): number | null {
  if (prevMs == null || nowMs == null) return null;
  return WARNING_MARKS_MS.find((m) => prevMs > m && nowMs <= m) ?? null;
}
