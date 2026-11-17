import { z } from "zod";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z.string().max(max, {
        error: `${label} pode ter no máximo ${max.toLocaleString("pt-BR")} caracteres.`,
      }),
    )
    .transform((value) => (value === "" ? null : value));

export const examInfoSchema = z.object({
  title: z
    .string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(1, { error: "Dê um nome para a prova." })
        .max(120, { error: "O nome pode ter no máximo 120 caracteres." }),
    ),
  description: optionalText(2000, "A descrição"),
  instructions: optionalText(5000, "As instruções"),
});

const optionalPositiveInt = (max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const number = Number(value);
      if (!Number.isInteger(number) || number < 1 || number > max) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return number;
    });

export const examRulesSchema = z
  .object({
    drawMode: z.enum(["all", "some"]),
    questionsPerAttempt: optionalPositiveInt(200, "Informe quantas questões cada aluno recebe."),
    timeMode: z.enum(["none", "limit"]),
    timeLimitMinutes: optionalPositiveInt(600, "Informe o tempo em minutos (de 1 a 600)."),
    resultVisibility: z.enum(["score_only", "score_and_key"]),
    shuffleQuestions: z.boolean(),
    shuffleOptions: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.drawMode === "some" && data.questionsPerAttempt === null) {
      ctx.addIssue({
        code: "custom",
        path: ["questionsPerAttempt"],
        message: "Informe quantas questões cada aluno recebe.",
      });
    }
    if (data.timeMode === "limit" && data.timeLimitMinutes === null) {
      ctx.addIssue({
        code: "custom",
        path: ["timeLimitMinutes"],
        message: "Informe o tempo em minutos (de 1 a 600).",
      });
    }
  })
  .transform((data) => ({
    questionsPerAttempt: data.drawMode === "some" ? data.questionsPerAttempt : null,
    timeLimitMinutes: data.timeMode === "limit" ? data.timeLimitMinutes : null,
    resultVisibility: data.resultVisibility,
    shuffleQuestions: data.shuffleQuestions,
    shuffleOptions: data.shuffleOptions,
  }));

export const assignmentSchema = z
  .object({
    classId: z.uuid({ error: "Escolha a turma." }),
    opensAt: z.iso.datetime({ offset: true, error: "Informe quando a prova abre." }),
    closesAt: z.iso.datetime({ offset: true, error: "Informe quando a prova fecha." }),
    requireAccessCode: z.boolean(),
  })
  .refine((data) => new Date(data.closesAt) > new Date(data.opensAt), {
    path: ["closesAt"],
    error: "O fechamento precisa ser depois da abertura.",
  });

/** Código de acesso de 4 dígitos, mostrado pelo professor na sala. */
export function generateAccessCode(random: () => number = Math.random): string {
  return String(Math.floor(random() * 10000)).padStart(4, "0");
}
