/**
 * Vocabulário pirata da marca (o "rr" de Vestibularr é o "arrr"). Regras: no máximo uma piada por tela,
 * nunca ironia com o erro e nada de pirata dentro do simulado cronometrado (lá é foco total).
 * "Arr!" comemora; "Err…" amortece um tropeço.
 */
export const ARR = ["Arr, acertou! 🏴‍☠️", "Arr! Mandou bem, marujo!", "Arr! Mais um pro tesouro 💰", "Na mosca, capitão! ⚓"] as const;
export const ERR = ["Err… quase!", "Err… essa escapou.", "Err… bora ver o pulo do gato?"] as const;

/** Escolha estável (sem sorteio na renderização): a mesma questão sempre mostra a mesma frase. */
export const pick = <T,>(list: readonly T[], seed: number) => list[Math.abs(Math.trunc(seed)) % list.length];
