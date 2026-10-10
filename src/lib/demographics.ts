import { z } from "zod";

/**
 * Perguntas opcionais "Sobre você" (onboarding e Perfil). Servem só para entender o público em números agregados;
 * nunca aparecem para outros alunos. Toda pergunta tem "Prefiro não dizer" (ou pode ficar em branco).
 */
export const DEMO_FIELDS = {
  age_range: { label: "Sua idade", options: [["ate14", "Até 14"], ["15_16", "15 a 16"], ["17", "17"], ["18_19", "18 a 19"], ["20_24", "20 a 24"], ["25_mais", "25 ou mais"], ["nd", "Prefiro não dizer"]] },
  gender: { label: "Gênero", options: [["feminino", "Feminino"], ["masculino", "Masculino"], ["nao_binario", "Não binário"], ["outro", "Outro"], ["nd", "Prefiro não dizer"]] },
  school_type: { label: "Onde você estuda (ou estudou) o ensino médio", options: [["publica", "Escola pública"], ["particular", "Escola particular"], ["bolsista", "Particular com bolsa"], ["eja", "EJA / supletivo"], ["nd", "Prefiro não dizer"]] },
  school_year: { label: "Em que ano você está", options: [["1em", "1º ano do EM"], ["2em", "2º ano do EM"], ["3em", "3º ano do EM"], ["concluido", "Já terminei o EM"], ["superior", "Já faço/fiz faculdade"], ["nd", "Prefiro não dizer"]] },
  referral: { label: "Como conheceu o Vestibularr", options: [["amigo", "Amigo ou colega"], ["escola", "Professor ou escola"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["youtube", "YouTube"], ["google", "Google"], ["outro", "Outro"]] },
} as const;
export type DemoField = keyof typeof DEMO_FIELDS;

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;

const opt = <K extends DemoField>(k: K) =>
  z.enum(DEMO_FIELDS[k].options.map(([v]) => v) as [string, ...string[]]).nullish();

export const demographicsSchema = z.object({
  age_range: opt("age_range"),
  gender: opt("gender"),
  school_type: opt("school_type"),
  school_year: opt("school_year"),
  referral: opt("referral"),
  state: z.enum(UFS).nullish(),
  city: z.string().trim().max(60).nullish(),
});
export type Demographics = z.infer<typeof demographicsSchema>;

export const demoLabel = (k: DemoField, v: string | null | undefined) =>
  (DEMO_FIELDS[k].options as readonly (readonly [string, string])[]).find(([x]) => x === v)?.[1] ?? "—";
