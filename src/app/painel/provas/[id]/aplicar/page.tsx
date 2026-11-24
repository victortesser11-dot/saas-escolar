import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { listClasses } from "@/lib/classes/queries";
import { getExamDetail } from "@/lib/exams/queries";
import { createAssignment } from "../../actions";
import { AssignmentForm } from "./assignment-form";

type Props = PageProps<"/painel/provas/[id]/aplicar">;

export default function AssignPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const [exam, classes] = await Promise.all([getExamDetail(id), listClasses({ archived: false })]);
  if (exam.status !== "published") notFound();

  const assigned = new Set(exam.assignments.map((a) => a.classId));
  const available = classes.filter((c) => !assigned.has(c.id));

  return (
    <div className="grid max-w-2xl gap-8">
      <title>{`Aplicar ${exam.title} · Avaliações Escolares`}</title>
      <PageHeader
        back={{ href: `/painel/provas/${exam.id}`, label: exam.title }}
        title="Aplicar em turma"
        description="Escolha a turma e o período em que a prova fica aberta. A turma recebe um link próprio."
      />
      {classes.length === 0 ? (
        <EmptyState
          title="Você ainda não tem turmas"
          description="Crie a turma. Os alunos entram com nome e número e já ficam cadastrados nela."
        >
          <Link href="/painel/turmas/nova" className={buttonVariants()}>
            Criar turma
          </Link>
        </EmptyState>
      ) : available.length === 0 ? (
        <EmptyState
          title="A prova já está em todas as suas turmas"
          description="Cada turma recebe a prova uma vez. Veja os links na página da prova."
        >
          <Link
            href={`/painel/provas/${exam.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Voltar para a prova
          </Link>
        </EmptyState>
      ) : (
        <AssignmentForm
          choose="class"
          action={createAssignment.bind(null, exam.id)}
          cancelHref={`/painel/provas/${exam.id}`}
          options={available.map((c) => ({
            id: c.id,
            label: `${c.name}${c.schoolYear ? ` (${c.schoolYear})` : ""} — ${c.studentCount} ${c.studentCount === 1 ? "aluno" : "alunos"}`,
            empty: c.studentCount === 0,
            selfEnroll: c.selfEnroll,
          }))}
          timeLimitMinutes={exam.timeLimitMinutes}
        />
      )}
    </div>
  );
}
