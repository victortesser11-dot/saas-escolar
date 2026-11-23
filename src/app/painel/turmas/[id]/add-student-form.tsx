"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { FormField } from "@/components/form/form-field";
import { FormMessage } from "@/components/form/form-message";
import { SubmitButton } from "@/components/form/submit-button";
import { initialFormState, type FormState } from "@/lib/form-state";

/** Cadastro rápido: depois de adicionar, limpa os campos e volta ao nome (digitação em sequência). */
export function AddStudentForm({
  action,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      formRef.current?.querySelector<HTMLInputElement>('input[name="fullName"]')?.focus();
    }
  }, [state]);

  const values = state.status === "error" ? state.values : undefined;

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="grid gap-4 rounded-md border-[1.5px] border-border bg-card p-4"
    >
      <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,9rem)_auto]">
        <FormField
          name="fullName"
          label="Nome completo"
          autoComplete="off"
          required
          defaultValue={values?.fullName}
          error={state.fieldErrors?.fullName}
        />
        <FormField
          name="registrationCode"
          label="Número na turma"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          placeholder="Ex.: 12"
          defaultValue={values?.registrationCode}
          error={state.fieldErrors?.registrationCode}
          className="font-mono uppercase"
        />
        <div className="sm:pt-[1.625rem]">
          <SubmitButton pendingLabel="Adicionando…">
            <Plus aria-hidden />
            Adicionar
          </SubmitButton>
        </div>
      </div>
      {state.message ? (
        <FormMessage
          type={state.status === "success" ? "success" : "error"}
          message={state.message}
        />
      ) : null}
    </form>
  );
}
