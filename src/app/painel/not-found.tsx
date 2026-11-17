import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <EmptyState
      title="Página não encontrada"
      description="Esta turma ou aluno não existe ou não pertence ao seu espaço."
    >
      <Link href="/painel" className={buttonVariants()}>
        Voltar para as turmas
      </Link>
    </EmptyState>
  );
}
