"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useId, useRef } from "react";
import { SubmitButton } from "@/components/form/submit-button";
import { Input } from "@/components/ui/input";
import { initialFormState, type FormState } from "@/lib/form-state";
import { SUBJECT_NAME_MAX } from "@/lib/subjects/schema";

/** Inclui uma disciplina na turma, sugerindo as que o professor já usa. */
export function AddSubjectForm({
  action,
  suggestions,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  suggestions: string[];
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const ids = useId();
  const error =
    state.status === "error" ? (state.fieldErrors?.subject ?? state.message) : undefined;

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-1.5">
      <label htmlFor={`${ids}-subject`} className="sr-only">
        Nova disciplina
      </label>
      <div className="flex gap-2">
        <Input
          id={`${ids}-subject`}
          name="subject"
          list={`${ids}-suggestions`}
          placeholder="Incluir disciplina (ex.: Ciências)"
          maxLength={SUBJECT_NAME_MAX}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${ids}-error` : undefined}
          className="max-w-72"
        />
        <datalist id={`${ids}-suggestions`}>
          {suggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <div className="w-auto">
          <SubmitButton variant="outline" pendingLabel="Incluindo…">
            <Plus aria-hidden />
            Incluir
          </SubmitButton>
        </div>
      </div>
      {error ? (
        <p id={`${ids}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
