import { Pencil, Upload } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { pluralize } from "@/lib/classes/messages";
import { getClassDetail } from "@/lib/classes/queries";
import { LocalDateTime } from "@/components/local-date-time";
import { StatusChip } from "@/components/status-chip";
import { listClassAssignments } from "@/lib/exams/queries";
import { ASSIGNMENT_STATUS_LABEL, assignmentStatus } from "@/lib/exams/rules";
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
  const [turma, assignments] = await Promise.all([getClassDetail(id), listClassAssignments(id)]);
  const now = new Date();
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

      {assignments.length > 0 ? (
        <section aria-labelledby="provas-turma-titulo" className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="provas-turma-titulo" className="text-lg font-semibold">
              Provas desta turma
            </h2>
            <Link
              href={`/painel/notas/${turma.id}`}
              className="text-sm underline decoration-mark decoration-[3px] underline-offset-4"
            >
              Ver boletim da turma
            </Link>
          </div>
          <ul className="grid gap-2">
            {assignments.map((a) => {
              const status = assignmentStatus(a, now);
              return (
                <li key={a.id}>
                  <Link
                    href={`/painel/provas/${a.examId}/turmas/${a.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border-[1.5px] border-border bg-card px-4 py-3 outline-none hover:border-foreground focus-visible:ring-4 focus-visible:ring-ring"
                  >
                    <span className="font-medium">{a.examTitle}</span>
                    <span className="flex items-center gap-3 text-sm text-muted-foreground">
                      <LocalDateTime iso={a.opensAt} />
                      <StatusChip tone={status}>{ASSIGNMENT_STATUS_LABEL[status]}</StatusChip>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

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
