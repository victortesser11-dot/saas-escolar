"use client";

import { useActionState } from "react";
import { FormField } from "@/components/form/form-field";
import { FormMessage } from "@/components/form/form-message";
import { SubmitButton } from "@/components/form/submit-button";
import { initialFormState, type FormState } from "@/lib/form-state";

export function StudentForm({
  action,
  defaults,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults: { fullName: string; registrationCode: string };
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const values = state.values ?? defaults;

  return (
    <form action={formAction} className="grid max-w-md gap-5" noValidate>
      {state.message ? (
        <FormMessage
          type={state.status === "success" ? "success" : "error"}
          message={state.message}
        />
      ) : null}
      <FormField
        name="fullName"
        label="Nome completo"
        autoComplete="off"
        required
        defaultValue={values.fullName}
        error={state.fieldErrors?.fullName}
      />
      <FormField
        name="registrationCode"
        label="Matrícula"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        required
        hint="É com ela que o aluno se identifica na prova."
        defaultValue={values.registrationCode}
        error={state.fieldErrors?.registrationCode}
        className="font-mono uppercase"
      />
      <div className="max-w-56">
        <SubmitButton pendingLabel="Salvando…">Salvar alterações</SubmitButton>
      </div>
    </form>
  );
}
