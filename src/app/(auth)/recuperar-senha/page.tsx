import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/lib/auth/routes";
import { AuthCard } from "../_components/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Recuperar senha"
      description="Informe seu e-mail e enviaremos um link para criar uma nova senha."
      footer={
        <Link href={ROUTES.signIn} className="font-medium text-foreground hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
