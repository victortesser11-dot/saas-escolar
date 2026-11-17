import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ROUTES } from "@/lib/auth/routes";
import { AuthCard } from "../_components/auth-card";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

export default function SignInPage() {
  return (
    <AuthCard
      title="Entrar"
      description="Acesse seu painel de professor."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link href={ROUTES.signUp} className="font-medium text-foreground hover:underline">
            Criar conta grátis
          </Link>
        </>
      }
    >
      {/* O formulário lê parâmetros da URL (next, erro), por isso fica num limite de Suspense. */}
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
