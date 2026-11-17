"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { ROUTES } from "@/lib/auth/routes";
import { signIn } from "../actions";
import { FormField } from "@/components/form/form-field";
import { FormMessage } from "@/components/form/form-message";
import { GoogleSignIn } from "../_components/google-button";
import { SubmitButton } from "@/components/form/submit-button";
import { initialFormState } from "@/lib/form-state";

const QUERY_ERRORS: Record<string, string> = {
  link: "Este link é inválido ou expirou. Se precisar, solicite um novo.",
  google: "Não foi possível entrar com o Google. Tente novamente.",
};

export function SignInForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const queryError = QUERY_ERRORS[searchParams.get("erro") ?? ""];
  const [state, formAction] = useActionState(signIn, initialFormState);

  const errorMessage = state.status === "error" ? state.message : queryError;

  return (
    <>
      <GoogleSignIn next={next || undefined} />
      <form action={formAction} className="grid gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <FormMessage type="error" message={errorMessage} />
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
        <div className="grid gap-2">
          <FormField
            name="password"
            type="password"
            label="Senha"
            autoComplete="current-password"
            required
            error={state.fieldErrors?.password}
          />
          <Link
            href={ROUTES.forgotPassword}
            className="justify-self-end text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>
        <SubmitButton pendingLabel="Entrando…">Entrar</SubmitButton>
      </form>
    </>
  );
}
