import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { getClassDetail } from "@/lib/classes/queries";
import { importStudents } from "../../../actions";
import { ImportStudents } from "./import-students";

export default function ImportPage({ params }: PageProps<"/painel/turmas/[id]/importar">) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted" />}>
      <ImportContent params={params} />
    </Suspense>
  );
}

async function ImportContent({
  params,
}: Pick<PageProps<"/painel/turmas/[id]/importar">, "params">) {
  const { id } = await params;
  const turma = await getClassDetail(id);
  if (turma.archivedAt) notFound();

  return (
    <div className="grid gap-8">
      <title>{`Importar alunos · ${turma.name} · Avaliações Escolares`}</title>
      <PageHeader
        back={{ href: `/painel/turmas/${turma.id}`, label: turma.name }}
        title="Importar planilha"
        description="Envie um arquivo CSV com o nome e a matrícula dos alunos. Você confere tudo antes de confirmar."
      />
      <ImportStudents classId={turma.id} action={importStudents.bind(null, turma.id)} />
    </div>
  );
}
