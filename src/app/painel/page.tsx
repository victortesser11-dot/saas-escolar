import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Painel" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="h-16 w-64 animate-pulse rounded-lg bg-muted" />}>
      <Welcome />
    </Suspense>
  );
}

async function Welcome() {
  const user = await getCurrentUser();
  const firstName = user.fullName.split(" ")[0] || "professor(a)";

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {firstName}</h1>
        <p className="mt-1 text-muted-foreground">Bem-vindo(a) ao seu painel.</p>
      </div>

      <section className="rounded-xl border border-dashed p-8 text-center">
        <h2 className="font-medium">Seu espaço está pronto</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Em breve você poderá cadastrar turmas e alunos, montar seu banco de questões e aplicar
          provas por aqui.
        </p>
      </section>
    </div>
  );
}
