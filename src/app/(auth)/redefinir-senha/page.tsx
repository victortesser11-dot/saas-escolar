import type { Metadata } from "next";
import { AuthCard } from "../_components/auth-card";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Nova senha" };

/** Acessada pelo link de recuperação; o proxy exige sessão válida. */
export default function ResetPasswordPage() {
  return (
    <AuthCard title="Criar nova senha" description="Escolha uma senha nova para sua conta.">
      <ResetPasswordForm />
    </AuthCard>
  );
}
