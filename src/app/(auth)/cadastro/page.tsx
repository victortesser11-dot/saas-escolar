import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/lib/auth/routes";
import { AuthCard } from "../_components/auth-card";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <AuthCard
      title="Criar conta"
      description="Grátis para professores. Sem cartão de crédito."
      footer={
        <>
          Já tem conta?{" "}
          <Link href={ROUTES.signIn} className="font-medium text-foreground hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
