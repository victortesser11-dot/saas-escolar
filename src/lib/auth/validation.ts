import { z } from "zod";

/** Mínimo alinhado a supabase/config.toml (auth.minimum_password_length). */
export const PASSWORD_MIN_LENGTH = 8;
/** Limite do bcrypt usado pelo Supabase Auth. */
const PASSWORD_MAX_LENGTH = 72;

const email = z
  .string({ error: "Informe seu e-mail." })
  .trim()
  .toLowerCase()
  .min(1, { error: "Informe seu e-mail." })
  .pipe(z.email({ error: "Informe um e-mail válido." }));

const newPassword = z
  .string({ error: "Informe uma senha." })
  .min(PASSWORD_MIN_LENGTH, {
    error: `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  })
  .max(PASSWORD_MAX_LENGTH, {
    error: `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
  });

export const signInSchema = z.object({
  email,
  password: z.string({ error: "Informe sua senha." }).min(1, { error: "Informe sua senha." }),
});

export const signUpSchema = z.object({
  fullName: z
    .string({ error: "Informe seu nome." })
    .trim()
    .min(2, { error: "Informe seu nome completo." })
    .max(120, { error: "O nome pode ter no máximo 120 caracteres." }),
  email,
  password: newPassword,
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string({ error: "Confirme a nova senha." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "As senhas não conferem.",
    path: ["confirmPassword"],
  });

export type FieldErrors = Partial<Record<string, string>>;

/** Primeiro erro de cada campo, no formato usado pelos formulários. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}
