import type { FieldErrors } from "@/lib/auth/validation";

/** Estado retornado pelas Server Actions de autenticação aos formulários. */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
  /** Valores para repreencher o formulário (nunca inclui senhas). */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };
