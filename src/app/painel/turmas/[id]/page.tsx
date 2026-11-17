import { Pencil, Upload } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { pluralize } from "@/lib/classes/messages";
import { getClassDetail } from "@/lib/classes/queries";
import { addStudentToClass, setClassArchived } from "../../actions";
import { AddStudentForm } from "./add-student-form";
import { StudentTable } from "./student-table";

export default function ClassPage({ params }: PageProps<"/painel/turmas/[id]">) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted" />}>
      <ClassContent params={params} />
    </Suspense>
  );
}

async function ClassContent({ params }: Pick<PageProps<"/painel/turmas/[id]">, "params">) {
  const { id } = await params;
  const turma = await getClassDetail(id);
  const archived = turma.archivedAt !== null;

  return (
    <div className="grid gap-10">
      <title>{`${turma.name} · Avaliações Escolares`}</title>
      <PageHeader
        back={{ href: "/painel", label: "Turmas" }}
        eyebrow={[
          turma.schoolYear ? `Ano ${turma.schoolYear}` : null,
          pluralize(turma.students.length, "aluno", "alunos"),
        ]
          .filter(Boolean)
          .join(" · ")}
        title={turma.name}
        actions={
          archived ? null : (
            <>
              <Link
                href={`/painel/turmas/${turma.id}/importar`}
                className={buttonVariants({ variant: "outline" })}
              >
                <Upload aria-hidden />
                Importar planilha
              </Link>
              <Link
                href={`/painel/turmas/${turma.id}/editar`}
                className={buttonVariants({ variant: "ghost" })}
              >
                <Pencil aria-hidden />
                Editar turma
              </Link>
            </>
          )
        }
      />

      {archived ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border-[1.5px] border-dashed border-foreground/40 bg-secondary px-4 py-3">
          <p className="text-sm">
            <strong>Turma arquivada.</strong> Ela não aparece na lista principal e não recebe novos
            alunos.
          </p>
          <form action={setClassArchived.bind(null, turma.id, false)}>
            <Button type="submit" variant="outline" size="sm">
              Reativar turma
            </Button>
          </form>
        </div>
      ) : (
        <section aria-labelledby="adicionar-titulo" className="grid gap-3">
          <h2 id="adicionar-titulo" className="text-lg font-semibold">
            Adicionar aluno
          </h2>
          <AddStudentForm action={addStudentToClass.bind(null, turma.id)} />
        </section>
      )}

      <section aria-labelledby="alunos-titulo" className="grid gap-3">
        <h2 id="alunos-titulo" className="text-lg font-semibold">
          Alunos
        </h2>
        {turma.students.length === 0 ? (
          <EmptyState
            title="Nenhum aluno nesta turma"
            description="Adicione os alunos pelo formulário acima ou importe uma planilha com nome e matrícula."
          >
            {archived ? null : (
              <Link
                href={`/painel/turmas/${turma.id}/importar`}
                className={buttonVariants({ variant: "outline" })}
              >
                <Upload aria-hidden />
                Importar planilha
              </Link>
            )}
          </EmptyState>
        ) : (
          <StudentTable classId={turma.id} students={turma.students} readOnly={archived} />
        )}
      </section>
    </div>
  );
}
