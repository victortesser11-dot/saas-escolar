import { z } from "zod";
import {
  normalizeFullName,
  normalizeRegistrationCode,
  REGISTRATION_CODE_PATTERN,
} from "./registration-code";

export const studentSchema = z.object({
  fullName: z
    .string({ error: "Informe o nome do aluno." })
    .transform(normalizeFullName)
    .pipe(
      z
        .string()
        .min(2, { error: "Informe o nome completo do aluno." })
        .max(120, { error: "O nome pode ter no máximo 120 caracteres." }),
    ),
  registrationCode: z
    .string({ error: "Informe a matrícula." })
    .transform(normalizeRegistrationCode)
    .pipe(
      z
        .string()
        .min(1, { error: "Informe a matrícula." })
        .max(40, { error: "A matrícula pode ter no máximo 40 caracteres." })
        .regex(REGISTRATION_CODE_PATTERN, {
          error: "Use apenas letras, números e os símbolos . / _ - na matrícula.",
        }),
    ),
});

export type StudentInput = z.output<typeof studentSchema>;

export const classSchema = z.object({
  name: z
    .string({ error: "Informe o nome da turma." })
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(1, { error: "Informe o nome da turma." })
        .max(80, { error: "O nome pode ter no máximo 80 caracteres." }),
    ),
  schoolYear: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const year = Number(value);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        ctx.addIssue({ code: "custom", message: "Informe um ano letivo válido, como 2026." });
        return z.NEVER;
      }
      return year;
    }),
});

export type ClassInput = z.output<typeof classSchema>;
