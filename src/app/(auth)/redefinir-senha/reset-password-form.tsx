"use client";

import { useActionState } from "react";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";
import { updatePassword } from "../actions";
import { FormField } from "../_components/form-field";
import { FormMessage } from "../_components/form-message";
import { SubmitButton } from "../_components/submit-button";
import { initialFormState } from "../form-state";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, initialFormState);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage type="error" message={state.status === "error" ? state.message : undefined} />
      <FormField
        name="password"
        type="password"
        label="Nova senha"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        hint={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`}
        error={state.fieldErrors?.password}
      />
      <FormField
        name="confirmPassword"
        type="password"
        label="Confirme a nova senha"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton pendingLabel="Salvando…">Salvar nova senha</SubmitButton>
    </form>
  );
}
