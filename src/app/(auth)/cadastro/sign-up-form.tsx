"use client";

import { MailCheck } from "lucide-react";
import { useActionState } from "react";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";
import { signUp } from "../actions";
import { FormField } from "@/components/form/form-field";
import { FormMessage } from "@/components/form/form-message";
import { GoogleSignIn } from "../_components/google-button";
import { SubmitButton } from "@/components/form/submit-button";
import { initialFormState } from "@/lib/form-state";

export function SignUpForm() {
  const [state, formAction] = useActionState(signUp, initialFormState);

  if (state.status === "success") {
    return (
      <div className="grid justify-items-center gap-3 py-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <h2 className="font-medium">Verifique seu e-mail</h2>
        <p className="text-sm text-muted-foreground" role="status">
          {state.message}
        </p>
      </div>
    );
  }

  return (
    <>
      <GoogleSignIn />
      <form action={formAction} className="grid gap-4" noValidate>
        <FormMessage type="error" message={state.status === "error" ? state.message : undefined} />
        <FormField
          name="fullName"
          label="Nome completo"
          autoComplete="name"
          required
          defaultValue={state.values?.fullName}
          error={state.fieldErrors?.fullName}
        />
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
        <FormField
          name="password"
          type="password"
          label="Senha"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          hint={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres.`}
          error={state.fieldErrors?.password}
        />
        <SubmitButton pendingLabel="Criando conta…">Criar conta</SubmitButton>
      </form>
    </>
  );
}
