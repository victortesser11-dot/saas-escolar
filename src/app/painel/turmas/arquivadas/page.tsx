import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { listClasses } from "@/lib/classes/queries";
import { ClassCard, ClassGridSkeleton } from "../../_components/class-card";

export const metadata: Metadata = { title: "Turmas arquivadas" };

export default function ArchivedClassesPage() {
  return (
    <div className="grid gap-8">
      <PageHeader
        back={{ href: "/painel", label: "Turmas" }}
        title="Turmas arquivadas"
        description="Turmas de anos anteriores. Abra uma turma para consultar ou reativá-la."
      />
      <Suspense fallback={<ClassGridSkeleton />}>
        <ArchivedList />
      </Suspense>
    </div>
  );
}

async function ArchivedList() {
  const classes = await listClasses({ archived: true });
  if (classes.length === 0) {
    return (
      <EmptyState
        title="Nenhuma turma arquivada"
        description="Ao fim do ano letivo, arquive as turmas para manter a lista principal organizada."
      />
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {classes.map((item) => (
        <li key={item.id}>
          <ClassCard item={item} />
        </li>
      ))}
    </ul>
  );
}
