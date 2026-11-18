"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useId } from "react";
import { LEGAL_ROUTES } from "@/lib/legal";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/validation";
import { signUp } from "../actions";
import { FormField } from "@/components/form/form-field";
import { FormMessage } from "@/components/form/form-message";
import { GoogleSignIn } from "../_components/google-button";
import { SubmitButton } from "@/components/form/submit-button";
import { initialFormState } from "@/lib/form-state";

export function SignUpForm() {
  const [state, formAction] = useActionState(signUp, initialFormState);
  const termsErrorId = useId();

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
        <div className="grid gap-1.5">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="acceptTerms"
              required
              aria-invalid={state.fieldErrors?.acceptTerms ? true : undefined}
              aria-describedby={state.fieldErrors?.acceptTerms ? termsErrorId : undefined}
              className="mt-0.5 size-4 shrink-0 accent-foreground"
            />
            <span className="text-muted-foreground">
              Li e aceito os{" "}
              <Link href={LEGAL_ROUTES.terms} target="_blank" className="text-foreground underline">
                Termos de uso
              </Link>{" "}
              e a{" "}
              <Link
                href={LEGAL_ROUTES.privacy}
                target="_blank"
                className="text-foreground underline"
              >
                Política de privacidade
              </Link>
              .
            </span>
          </label>
          {state.fieldErrors?.acceptTerms ? (
            <p id={termsErrorId} className="text-sm text-destructive">
              {state.fieldErrors.acceptTerms}
            </p>
          ) : null}
        </div>
        <SubmitButton pendingLabel="Criando conta…">Criar conta</SubmitButton>
      </form>
    </>
  );
}
