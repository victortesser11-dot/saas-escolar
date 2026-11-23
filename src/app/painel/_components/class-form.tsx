"use client";

import { useActionState } from "react";
import { FormField } from "@/components/form/form-field";
import { FormMessage } from "@/components/form/form-message";
import { SubmitButton } from "@/components/form/submit-button";
import { initialFormState, type FormState } from "@/lib/form-state";

type ClassFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults: { name: string; schoolYear: string };
  submitLabel: string;
  /** Mostra o campo de disciplinas (só na criação; depois, a página da turma gerencia). */
  withSubjects?: boolean;
};

/** Formulário de criação/edição de turma. */
export function ClassForm({ action, defaults, submitLabel, withSubjects = false }: ClassFormProps) {
  const [state, formAction] = useActionState(action, initialFormState);
  const values = state.values ?? defaults;

  return (
    <form action={formAction} className="grid max-w-md gap-5" noValidate>
      <FormMessage type="error" message={state.status === "error" ? state.message : undefined} />
      <FormField
        name="name"
        label="Nome da turma"
        placeholder="Ex.: 7º ano B"
        required
        maxLength={80}
        autoComplete="off"
        defaultValue={values.name}
        error={state.fieldErrors?.name}
      />
      {withSubjects ? (
        <FormField
          name="subjects"
          label="Disciplinas que você dá nesta turma"
          placeholder="Ex.: Matemática, Ciências"
          maxLength={600}
          autoComplete="off"
          hint="Opcional. Separe por vírgula. Também dá para incluir depois."
          defaultValue={(values as { subjects?: string }).subjects ?? ""}
          error={state.fieldErrors?.subjects}
        />
      ) : null}
      <FormField
        name="schoolYear"
        label="Ano letivo"
        inputMode="numeric"
        placeholder="Ex.: 2026"
        maxLength={4}
        autoComplete="off"
        hint="Opcional. Ajuda a separar as turmas de cada ano."
        defaultValue={values.schoolYear}
        error={state.fieldErrors?.schoolYear}
        className="max-w-32 font-mono"
      />
      <div className="max-w-56">
        <SubmitButton pendingLabel="Salvando…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
