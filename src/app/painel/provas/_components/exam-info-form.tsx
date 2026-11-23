"use client";

import { useActionState, useId } from "react";
import { FormField } from "@/components/form/form-field";
import { FormMessage } from "@/components/form/form-message";
import { SubmitButton } from "@/components/form/submit-button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialFormState, type FormState } from "@/lib/form-state";
import { SUBJECT_NAME_MAX } from "@/lib/subjects/schema";

/** Nome, descrição (só para o professor) e instruções (mostradas ao aluno). */
export function ExamInfoForm({
  action,
  defaults,
  submitLabel,
  subjects,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults: { title: string; subject: string; description: string; instructions: string };
  submitLabel: string;
  /** Disciplinas já usadas pelo professor (sugestões). */
  subjects: string[];
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const values = state.values ?? defaults;
  const ids = useId();

  return (
    <form action={formAction} className="grid max-w-2xl gap-5" noValidate>
      <FormMessage type="error" message={state.status === "error" ? state.message : undefined} />
      <FormField
        name="title"
        label="Nome da prova"
        placeholder="Ex.: Avaliação de frações — 1º bimestre"
        required
        maxLength={120}
        autoComplete="off"
        defaultValue={values.title}
        error={state.fieldErrors?.title}
      />
      <div className="grid max-w-sm gap-2">
        <FormField
          name="subject"
          label="Disciplina"
          placeholder="Ex.: Matemática"
          maxLength={SUBJECT_NAME_MAX}
          autoComplete="off"
          list={`${ids}-subjects`}
          hint="Opcional. Separa as provas e o boletim de cada turma por disciplina."
          defaultValue={values.subject}
          error={state.fieldErrors?.subject}
        />
        <datalist id={`${ids}-subjects`}>
          {subjects.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${ids}-instructions`}>
          Instruções para os alunos{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id={`${ids}-instructions`}
          name="instructions"
          defaultValue={values.instructions}
          maxLength={5000}
          placeholder="Ex.: Leia com atenção. Não é permitido consultar o caderno."
          className="min-h-20"
        />
        <p className="text-xs text-muted-foreground">Aparecem para o aluno antes de começar.</p>
        {state.fieldErrors?.instructions ? (
          <p className="text-xs text-destructive">{state.fieldErrors.instructions}</p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${ids}-description`}>
          Anotações <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id={`${ids}-description`}
          name="description"
          defaultValue={values.description}
          maxLength={2000}
          className="min-h-16"
        />
        <p className="text-xs text-muted-foreground">Visíveis só para você.</p>
        {state.fieldErrors?.description ? (
          <p className="text-xs text-destructive">{state.fieldErrors.description}</p>
        ) : null}
      </div>
      <div className="max-w-56">
        <SubmitButton pendingLabel="Salvando…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
