import type { Database } from "@/lib/supabase/database.types";

export type QuestionType = Database["public"]["Enums"]["question_type"];

export type Grading = "auto" | "auto-review" | "manual";

export type QuestionTypeInfo = {
  type: QuestionType;
  label: string;
  /** Rótulo curto para listas (mono). */
  short: string;
  description: string;
  grading: Grading;
};

/** Ordem de exibição e textos dos tipos de questão. */
export const QUESTION_TYPES: QuestionTypeInfo[] = [
  {
    type: "single_choice",
    label: "Múltipla escolha",
    short: "Múltipla escolha",
    description: "Várias alternativas, uma correta.",
    grading: "auto",
  },
  {
    type: "true_false",
    label: "Verdadeiro ou falso",
    short: "V ou F",
    description: "O aluno julga uma afirmação.",
    grading: "auto",
  },
  {
    type: "multiple_choice",
    label: "Seleção múltipla",
    short: "Seleção múltipla",
    description:
      "Várias alternativas, uma ou mais corretas. Vale a questão inteira só se acertar todas.",
    grading: "auto",
  },
  {
    type: "short_answer",
    label: "Resposta curta",
    short: "Resposta curta",
    description: "Uma palavra, número ou expressão. Você cadastra as respostas aceitas.",
    grading: "auto-review",
  },
  {
    type: "essay",
    label: "Dissertativa",
    short: "Dissertativa",
    description: "Resposta em texto livre, corrigida por você.",
    grading: "manual",
  },
];

export const GRADING_LABEL: Record<Grading, string> = {
  auto: "Correção automática",
  "auto-review": "Correção automática, revisável",
  manual: "Correção manual",
};

export function questionTypeInfo(type: QuestionType): QuestionTypeInfo {
  return QUESTION_TYPES.find((info) => info.type === type) ?? QUESTION_TYPES[0];
}

export function isQuestionType(value: unknown): value is QuestionType {
  return QUESTION_TYPES.some((info) => info.type === value);
}

export const TRUE_FALSE_OPTIONS = ["Verdadeiro", "Falso"] as const;

/** Letra da alternativa: A, B, C… */
export function optionLetter(index: number) {
  return String.fromCharCode(65 + index);
}
