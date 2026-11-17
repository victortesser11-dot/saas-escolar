import { z } from "zod";
import { MAX_POINTS, parsePoints } from "./points";
import { normalizeShortAnswer } from "./short-answer";
import { QUESTION_TYPES, TRUE_FALSE_OPTIONS, type QuestionType } from "./types";

/*
 * Validação do editor de questões. Espelha as regras da função save_question do banco
 * (que continua sendo a garantia final).
 */

export const MAX_OPTIONS = 10;
export const MAX_TAGS = 10;

const questionTypes = QUESTION_TYPES.map((info) => info.type) as [QuestionType, ...QuestionType[]];

/** "Frações, 7º ano ,frações" → ["frações", "7º ano"] */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[,;\n]/)) {
    const tag = part.replace(/\s+/g, " ").trim().toLowerCase();
    if (tag) seen.add(tag);
  }
  return [...seen];
}

const optionSchema = z.object({
  body: z.string().transform((value) => value.trim()),
  isCorrect: z.boolean(),
});

export const questionSchema = z
  .object({
    type: z.enum(questionTypes, { error: "Escolha o tipo da questão." }),
    stem: z
      .string()
      .transform((value) => value.trim())
      .pipe(
        z
          .string()
          .min(1, { error: "Escreva o enunciado da questão." })
          .max(5000, { error: "O enunciado pode ter no máximo 5.000 caracteres." }),
      ),
    explanation: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().max(5000, { error: "O texto pode ter no máximo 5.000 caracteres." })),
    points: z.string().transform((value, ctx) => {
      const points = parsePoints(value);
      if (points === null) {
        ctx.addIssue({
          code: "custom",
          message: `Informe um valor entre 0,01 e ${MAX_POINTS}, como 1 ou 1,5.`,
        });
        return z.NEVER;
      }
      return points;
    }),
    tags: z.string().transform((value, ctx) => {
      const tags = parseTags(value);
      if (tags.length > MAX_TAGS) {
        ctx.addIssue({ code: "custom", message: `Use no máximo ${MAX_TAGS} assuntos.` });
        return z.NEVER;
      }
      if (tags.some((tag) => tag.length > 40)) {
        ctx.addIssue({ code: "custom", message: "Cada assunto pode ter no máximo 40 caracteres." });
        return z.NEVER;
      }
      return tags;
    }),
    options: z.array(optionSchema).max(MAX_OPTIONS, {
      error: `Use no máximo ${MAX_OPTIONS} alternativas.`,
    }),
  })
  .superRefine((data, ctx) => {
    const { type } = data;
    const options = data.options;

    if (type === "essay") return;

    if (type === "true_false") {
      const correct = options.filter((o) => o.isCorrect).length;
      if (options.length !== 2 || correct !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "Marque se a afirmação é verdadeira ou falsa.",
        });
      }
      return;
    }

    options.forEach((option, index) => {
      if (option.body === "") {
        ctx.addIssue({
          code: "custom",
          path: ["options", index, "body"],
          message:
            type === "short_answer"
              ? "Preencha a resposta ou remova a linha."
              : "Preencha a alternativa ou remova-a.",
        });
      } else if (option.body.length > 1000) {
        ctx.addIssue({
          code: "custom",
          path: ["options", index, "body"],
          message: "Use no máximo 1.000 caracteres.",
        });
      }
    });

    const seen = new Map<string, number>();
    options.forEach((option, index) => {
      if (option.body === "") return;
      const key = normalizeShortAnswer(option.body);
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["options", index, "body"],
          message: "Repetida: igual a outra alternativa.",
        });
      } else {
        seen.set(key, index);
      }
    });

    const correct = options.filter((o) => o.isCorrect).length;

    if (type === "short_answer") {
      if (options.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "Cadastre ao menos uma resposta aceita.",
        });
      }
      return;
    }

    if (options.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Cadastre ao menos 2 alternativas.",
      });
    } else if (type === "single_choice" && correct !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Marque qual é a alternativa correta.",
      });
    } else if (type === "multiple_choice" && correct < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Marque ao menos uma alternativa correta.",
      });
    }
  })
  .transform((data) => ({
    ...data,
    explanation: data.explanation === "" ? null : data.explanation,
    options:
      data.type === "essay"
        ? []
        : data.type === "true_false"
          ? TRUE_FALSE_OPTIONS.map((body, index) => ({
              body,
              isCorrect: data.options[index]?.isCorrect ?? false,
            }))
          : data.type === "short_answer"
            ? data.options.map((o) => ({ body: o.body, isCorrect: true }))
            : data.options,
  }));

export type QuestionInput = z.input<typeof questionSchema>;
export type QuestionData = z.output<typeof questionSchema>;

/** Erros indexados por caminho ("stem", "options", "options.2.body"). */
export function toQuestionErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}
