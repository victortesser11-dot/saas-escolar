import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { pluralize } from "@/lib/classes/messages";
import { getClassDetail } from "@/lib/classes/queries";
import { listApplicableExams } from "@/lib/exams/queries";
import { AssignmentForm } from "../../../provas/[id]/aplicar/assignment-form";
import { createAssignmentForClass } from "../../../provas/actions";

type Props = PageProps<"/painel/turmas/[id]/aplicar">;

export default function ApplyToClassPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const turma = await getClassDetail(id);
  if (turma.archivedAt) notFound();
  const exams = await listApplicableExams(
    turma.id,
    turma.subjects.map((s) => s.id),
  );

  return (
    <div className="grid max-w-2xl grid-cols-1 gap-8">
      <title>{`Aplicar prova · ${turma.name} · Avaliações Escolares`}</title>
      <PageHeader
        back={{ href: `/painel/turmas/${turma.id}`, label: turma.name }}
        title="Aplicar prova nesta turma"
        description="Escolha a prova e o período em que ela fica aberta. A turma recebe um link próprio."
      />
      {exams.length === 0 ? (
        <EmptyState
          title="Nenhuma prova publicada para aplicar"
          description="Só provas publicadas podem ser aplicadas, e cada uma entra uma vez por turma. Publique uma prova e volte aqui."
        >
          <Link href="/painel/provas" className={buttonVariants()}>
            Ir para provas
          </Link>
        </EmptyState>
      ) : (
        <AssignmentForm
          choose="exam"
          action={createAssignmentForClass.bind(null, turma.id)}
          cancelHref={`/painel/turmas/${turma.id}`}
          fixedClass={{
            id: turma.id,
            empty: turma.students.length === 0,
            selfEnroll: turma.selfEnroll,
          }}
          options={exams.map((e) => ({
            id: e.id,
            label: [e.title, e.subjectName, pluralize(e.questionCount, "questão", "questões")]
              .filter(Boolean)
              .join(" — "),
            timeLimitMinutes: e.timeLimitMinutes,
          }))}
        />
      )}
    </div>
  );
}
