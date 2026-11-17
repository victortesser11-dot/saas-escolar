import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { getExamDetail } from "@/lib/exams/queries";
import { updateExamInfo } from "../../actions";
import { ExamInfoForm } from "../../_components/exam-info-form";

type Props = PageProps<"/painel/provas/[id]/editar">;

export default function EditExamPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-muted" />}>
      <EditExamContent params={params} />
    </Suspense>
  );
}

async function EditExamContent({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const exam = await getExamDetail(id);
  return (
    <div className="grid gap-8">
      <title>{`Editar ${exam.title} · Avaliações Escolares`}</title>
      <PageHeader
        back={{ href: `/painel/provas/${exam.id}`, label: exam.title }}
        title="Nome e instruções"
      />
      <ExamInfoForm
        action={updateExamInfo.bind(null, exam.id)}
        defaults={{
          title: exam.title,
          description: exam.description ?? "",
          instructions: exam.instructions ?? "",
        }}
        submitLabel="Salvar"
      />
    </div>
  );
}
