import { Pencil, Upload, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { LocalDateTime } from "@/components/local-date-time";
import { PageHeader } from "@/components/page-header";
import { StatusChip } from "@/components/status-chip";
import { Button, buttonVariants } from "@/components/ui/button";
import { pluralize } from "@/lib/classes/messages";
import { getClassDetail, type ClassDetail } from "@/lib/classes/queries";
import { listClassAssignments } from "@/lib/exams/queries";
import { ASSIGNMENT_STATUS_LABEL, assignmentStatus } from "@/lib/exams/rules";
import { listSubjects } from "@/lib/subjects/queries";
import {
  addStudentToClass,
  addSubjectToClass,
  removeSubjectFromClass,
  setClassArchived,
  setClassSelfEnroll,
} from "../../actions";
import { AddStudentForm } from "./add-student-form";
import { AddSubjectForm } from "./add-subject-form";
import { StudentTable } from "./student-table";

type Assignment = Awaited<ReturnType<typeof listClassAssignments>>[number];

export default function ClassPage({ params }: PageProps<"/painel/turmas/[id]">) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted" />}>
      <ClassContent params={params} />
    </Suspense>
  );
}

async function ClassContent({ params }: Pick<PageProps<"/painel/turmas/[id]">, "params">) {
  const { id } = await params;
  const [turma, assignments, allSubjects] = await Promise.all([
    getClassDetail(id),
    listClassAssignments(id),
    listSubjects(),
  ]);
  const archived = turma.archivedAt !== null;
  const subjectsInUse = new Set(assignments.map((a) => a.subject?.id).filter(Boolean));
  const suggestions = allSubjects
    .filter((s) => !turma.subjects.some((t) => t.id === s.id))
    .map((s) => s.name);

  return (
    <div className="grid grid-cols-1 gap-10">
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
            <Link
              href={`/painel/turmas/${turma.id}/editar`}
              className={buttonVariants({ variant: "ghost" })}
            >
              <Pencil aria-hidden />
              Editar turma
            </Link>
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
      ) : null}

      <section aria-labelledby="disciplinas-titulo" className="grid grid-cols-1 gap-3">
        <h2 id="disciplinas-titulo" className="text-lg font-semibold">
          Disciplinas
        </h2>
        {turma.subjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Inclua as disciplinas que você dá nesta turma. As provas e o boletim ficam separados por
            disciplina.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2" aria-label="Disciplinas da turma">
            {turma.subjects.map((subject) => (
              <li
                key={subject.id}
                className="flex items-center gap-1 rounded-md border-[1.5px] border-foreground bg-card py-1 pr-1 pl-3 text-sm font-medium"
              >
                {subject.name}
                {archived || subjectsInUse.has(subject.id) ? (
                  <span className="w-1" />
                ) : (
                  <form action={removeSubjectFromClass.bind(null, turma.id, subject.id)}>
                    <button
                      type="submit"
                      aria-label={`Tirar ${subject.name} da turma`}
                      className="flex size-7 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {archived ? null : (
          <AddSubjectForm
            action={addSubjectToClass.bind(null, turma.id)}
            suggestions={suggestions}
          />
        )}
      </section>

      {assignments.length > 0 ? (
        <ExamsBySubject classId={turma.id} subjects={turma.subjects} assignments={assignments} />
      ) : null}

      <section aria-labelledby="alunos-titulo" className="grid grid-cols-1 gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="alunos-titulo" className="text-lg font-semibold">
            Alunos
          </h2>
          {archived ? null : (
            <Link
              href={`/painel/turmas/${turma.id}/importar`}
              className="inline-flex items-center gap-1.5 text-sm underline decoration-mark decoration-[3px] underline-offset-4"
            >
              <Upload className="size-4" aria-hidden />
              Importar planilha
            </Link>
          )}
        </div>

        {archived ? null : <SelfEnrollCard turma={turma} />}

        {turma.students.length === 0 ? (
          <EmptyState
            title="Nenhum aluno ainda"
            description={
              turma.selfEnroll
                ? "Os alunos aparecem aqui quando entrarem na prova pelo link. Se preferir, adicione ou importe a lista agora."
                : "Adicione os alunos abaixo ou importe uma planilha com nome e número."
            }
          />
        ) : (
          <StudentTable classId={turma.id} students={turma.students} readOnly={archived} />
        )}

        {archived ? null : (
          <details className="group rounded-md border-[1.5px] border-border bg-card open:border-foreground">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium outline-none focus-visible:ring-4 focus-visible:ring-ring">
              <UserPlus className="size-4" aria-hidden />
              Adicionar aluno manualmente
            </summary>
            <div className="border-t border-border p-2 sm:p-3">
              <AddStudentForm action={addStudentToClass.bind(null, turma.id)} />
            </div>
          </details>
        )}
      </section>
    </div>
  );
}

function SelfEnrollCard({ turma }: { turma: ClassDetail }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border-[1.5px] border-dashed border-foreground/40 bg-paper px-4 py-3">
      <p className="max-w-xl text-sm">
        {turma.selfEnroll ? (
          <>
            <strong>Cadastro pela prova ligado.</strong> Quem não está na lista entra com nome e
            número e é incluído na turma. Confira os marcados como “entrou pela prova”.
          </>
        ) : (
          <>
            <strong>Lista fechada.</strong> Só entra na prova quem já está na lista abaixo.
          </>
        )}
      </p>
      <form action={setClassSelfEnroll.bind(null, turma.id, !turma.selfEnroll)}>
        <Button type="submit" variant="outline" size="sm">
          {turma.selfEnroll ? "Fechar a lista" : "Ligar cadastro pela prova"}
        </Button>
      </form>
    </div>
  );
}

function ExamsBySubject({
  classId,
  subjects,
  assignments,
}: {
  classId: string;
  subjects: { id: string; name: string }[];
  assignments: Assignment[];
}) {
  const now = new Date();
  const groups = subjects
    .map((subject) => ({
      key: subject.id,
      name: subject.name,
      items: assignments.filter((a) => a.subject?.id === subject.id),
    }))
    .filter((g) => g.items.length > 0);
  const known = new Set(subjects.map((s) => s.id));
  const others = assignments.filter((a) => !a.subject || !known.has(a.subject.id));
  if (others.length > 0) {
    groups.push({ key: "sem", name: groups.length > 0 ? "Sem disciplina" : "", items: others });
  }

  return (
    <section aria-labelledby="provas-turma-titulo" className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="provas-turma-titulo" className="text-lg font-semibold">
          Provas desta turma
        </h2>
        <Link
          href={`/painel/notas/${classId}`}
          className="text-sm underline decoration-mark decoration-[3px] underline-offset-4"
        >
          Ver boletim da turma
        </Link>
      </div>
      {groups.map((group) => (
        <div key={group.key} className="grid grid-cols-1 gap-2">
          {group.name ? (
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="label-mono text-muted-foreground">{group.name}</h3>
              {group.key !== "sem" ? (
                <Link
                  href={`/painel/notas/${classId}?disciplina=${group.key}`}
                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Boletim de {group.name}
                </Link>
              ) : null}
            </div>
          ) : null}
          <ul className="grid grid-cols-1 gap-2">
            {group.items.map((a) => {
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
        </div>
      ))}
    </section>
  );
}
