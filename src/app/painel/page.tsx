import { Archive, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { FilterableList } from "@/components/filterable-list";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { pluralize } from "@/lib/classes/messages";
import { countArchivedClasses, listClasses } from "@/lib/classes/queries";
import { ClassCard, ClassGridSkeleton } from "./_components/class-card";

export const metadata: Metadata = { title: "Painel" };

export default function DashboardPage() {
  return (
    <div className="grid gap-10">
      <Suspense fallback={<div className="h-20 w-72 animate-pulse rounded-sm bg-muted" />}>
        <Greeting />
      </Suspense>
      <section className="grid gap-4" aria-labelledby="turmas-titulo">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="turmas-titulo" className="text-xl font-semibold">
            Turmas
          </h2>
          <Link href="/painel/turmas/nova" className={buttonVariants()}>
            <Plus aria-hidden />
            Nova turma
          </Link>
        </div>
        <Suspense fallback={<ClassGridSkeleton />}>
          <ClassList />
        </Suspense>
      </section>
    </div>
  );
}

async function Greeting() {
  const user = await getCurrentUser();
  const firstName = user.fullName.split(" ")[0] || "professor(a)";
  return (
    <PageHeader
      eyebrow={user.workspace.name}
      title={`Olá, ${firstName}`}
      description="Organize suas turmas e alunos. Em seguida você poderá montar o banco de questões e aplicar provas."
    />
  );
}

async function ClassList() {
  const [classes, archivedCount] = await Promise.all([
    listClasses({ archived: false }),
    countArchivedClasses(),
  ]);

  return (
    <div className="grid gap-4">
      {classes.length === 0 ? (
        <EmptyState
          title="Nenhuma turma ainda"
          description="Crie sua primeira turma e adicione os alunos, um a um ou importando uma planilha."
        >
          <Link href="/painel/turmas/nova" className={buttonVariants()}>
            <Plus aria-hidden />
            Criar primeira turma
          </Link>
        </EmptyState>
      ) : (
        <FilterableList
          searchLabel="Buscar turma pelo nome"
          emptyLabel="Nenhuma turma encontrada com esse nome."
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          items={classes.map((item) => ({
            id: item.id,
            text: item.name,
            node: <ClassCard item={item} />,
          }))}
        />
      )}
      {archivedCount > 0 ? (
        <Link
          href="/painel/turmas/arquivadas"
          className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}
        >
          <Archive aria-hidden />
          {pluralize(archivedCount, "turma arquivada", "turmas arquivadas")}
        </Link>
      ) : null}
    </div>
  );
}
