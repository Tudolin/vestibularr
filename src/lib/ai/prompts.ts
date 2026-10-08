import { CHARS_PER_LINE, estimateLines } from "@/lib/essay/lines";

export type RubricCriterion = { key: string; name: string; description: string; max: number; step?: number };
export type Theme = { kind: "enem" | "ufpr"; title: string; prompt_md: string; support_texts_md: string | null; task_type: string; genre: string | null; line_limit: number; min_lines: number; max_score: number; official_mirror_md: string | null };

const BASE = `Você é um corretor experiente de vestibulares brasileiros. Corrija com rigor e justiça, em português do Brasil.
Responda SEMPRE e SOMENTE com um objeto JSON válido, sem texto fora do JSON.
Nos "highlights", cite trechos EXATOS copiados do texto do aluno (sem alterar uma letra), curtos (até 20 palavras).
Seja específico nas justificativas: aponte o que tirou pontos e o que manteria a nota.`;

export function enemPrompt(theme: Theme, rubric: { criteria: RubricCriterion[]; instructions: string }, text: string) {
  const lines = estimateLines(text);
  const system = `${BASE}

Tarefa: corrigir uma REDAÇÃO DO ENEM (texto dissertativo-argumentativo) nas 5 competências oficiais.
${rubric.criteria.map((c) => `- ${c.key} (${c.name}, 0 a ${c.max}, apenas múltiplos de ${c.step ?? 40}): ${c.description}`).join("\n")}
Regras: ${rubric.instructions}
Verifique na proposta de intervenção (C5) os 5 elementos: agente, ação, meio/modo, finalidade e detalhamento; para cada um diga se está presente e cite o trecho.

Formato JSON exato:
{"annulled":{"value":boolean,"reason":string|null},
 "competencies":[{"key":"c1","score":0|40|80|120|160|200,"justification":string}, ... c2..c5],
 "highlights":[{"quote":string,"comment":string,"criterion":"c1".."c5","type":"erro"|"acerto"|"sugestao"}],
 "suggestions":[string],
 "intervention":{"agent":{"present":boolean,"quote":string|null},"action":{...},"means":{...},"purpose":{...},"detail":{...}},
 "summary":string}`;
  const user = `TEMA: ${theme.title}
PROPOSTA: ${theme.prompt_md}
${theme.support_texts_md ? `TEXTOS MOTIVADORES:\n${theme.support_texts_md}\n` : ""}
Linhas estimadas (≈${CHARS_PER_LINE} caracteres/linha): ${lines} (limite 30; até 7 linhas = nota zero).

REDAÇÃO DO ALUNO:
"""
${text}
"""`;
  return { system, user };
}

export function ufprPrompt(theme: Theme, rubric: { criteria: RubricCriterion[]; instructions: string }, text: string) {
  const lines = estimateLines(text);
  const pts = (c: RubricCriterion) => +(c.max * theme.max_score).toFixed(3);
  const system = `${BASE}

Tarefa: corrigir uma questão de COMPREENSÃO E PRODUÇÃO DE TEXTOS do Vestibular UFPR.
Tipo de tarefa: ${theme.task_type}${theme.genre ? ` (gênero: ${theme.genre})` : ""}. Limite: ${theme.line_limit} linhas. Nota da questão: 0 a ${theme.max_score}.
Critérios (nota de cada um de 0 até o máximo indicado, pode usar decimais):
${rubric.criteria.map((c) => `- ${c.key} — ${c.name} (máx. ${pts(c)}): ${c.description}`).join("\n")}
Regras: ${rubric.instructions}
${theme.official_mirror_md ? "Há ESPELHO OFICIAL: use-o como referência principal do que a resposta deveria conter e comente a comparação em mirror_comparison." : ""}

Formato JSON exato:
{"annulled":{"value":boolean,"reason":string|null},
 "criteria":[{"key":string,"score":number,"justification":string}],
 "highlights":[{"quote":string,"comment":string,"criterion":string,"type":"erro"|"acerto"|"sugestao"}],
 "suggestions":[string],
 "mirror_comparison":string|null,
 "summary":string}`;
  const user = `COMANDO DA QUESTÃO: ${theme.prompt_md}
${theme.support_texts_md ? `TEXTO(S) DE APOIO:\n${theme.support_texts_md}\n` : ""}${theme.official_mirror_md ? `ESPELHO OFICIAL:\n${theme.official_mirror_md}\n` : ""}
Linhas estimadas: ${lines} (limite ${theme.line_limit}${lines > theme.line_limit ? " — PASSOU DO LIMITE" : ""}).

RESPOSTA DO ALUNO:
"""
${text}
"""`;
  return { system, user };
}

export function discursivePrompt(items: { id: string; statement: string; mirror: string | null; max: number; answer: string }[], rubricInstructions: string) {
  const system = `${BASE}

Tarefa: corrigir respostas DISCURSIVAS de provas antigas da UFPR comparando com o ESPELHO OFICIAL de cada questão.
${rubricInstructions}
Para cada item: liste os pontos do espelho encontrados ("found") e os que faltaram ("missing"), dê a nota de 0 até "max" e um feedback curto.
Se não houver espelho, avalie pela correção conceitual do enunciado e diga isso no feedback.
Formato JSON exato: {"items":[{"id":string,"score":number,"max":number,"found":[string],"missing":[string],"feedback":string}]}`;
  const user = items
    .map((i) => `### ITEM ${i.id} (máx. ${i.max})\nENUNCIADO:\n${i.statement}\n\nESPELHO OFICIAL:\n${i.mirror ?? "(sem espelho)"}\n\nRESPOSTA DO ALUNO:\n"""\n${i.answer}\n"""`)
    .join("\n\n");
  return { system, user };
}

export const TRANSCRIBE_SYSTEM = `Você transcreve redações manuscritas fotografadas, em português do Brasil.
Copie o texto EXATAMENTE como está escrito, preservando erros de ortografia, pontuação e quebras de parágrafo (não corrija nada).
Palavras ilegíveis: escreva [ilegível] no lugar e liste o contexto em "illegible".
Responda SOMENTE JSON: {"text":string,"illegible":[string],"confidence":"alta"|"media"|"baixa"}`;
