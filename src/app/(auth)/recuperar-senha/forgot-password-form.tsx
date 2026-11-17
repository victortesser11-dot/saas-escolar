"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "../actions";
import { FormField } from "../_components/form-field";
import { FormMessage } from "../_components/form-message";
import { SubmitButton } from "../_components/submit-button";
import { initialFormState } from "../form-state";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialFormState);

  if (state.status === "success") {
    return <FormMessage type="success" message={state.message} />;
  }

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <FormMessage type="error" message={state.status === "error" ? state.message : undefined} />
      <FormField
        name="email"
        type="email"
        label="E-mail"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingLabel="Enviando…">Enviar link</SubmitButton>
    </form>
  );
}
