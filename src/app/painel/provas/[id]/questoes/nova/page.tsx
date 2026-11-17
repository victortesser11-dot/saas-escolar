import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FormMessage } from "@/components/form/form-message";
import { PageHeader } from "@/components/page-header";
import { getExamDetail } from "@/lib/exams/queries";
import { isQuestionType } from "@/lib/questions/types";
import { saveQuestionToExam } from "../../../actions";
import { QuestionEditor } from "../../../../questoes/_components/question-editor";

type Props = PageProps<"/painel/provas/[id]/questoes/nova">;

export default function NewExamQuestionPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const exam = await getExamDetail(id);
  if (exam.status !== "draft") notFound();

  const requested = Array.isArray(query.tipo) ? query.tipo[0] : query.tipo;
  const type = isQuestionType(requested) ? requested : "single_choice";
  const savedMarker = Array.isArray(query.salva) ? query.salva[0] : query.salva;

  return (
    <div className="grid gap-8">
      <title>{`Nova questão · ${exam.title} · Avaliações Escolares`}</title>
      <PageHeader
        back={{ href: `/painel/provas/${exam.id}`, label: exam.title }}
        eyebrow={`Questão ${exam.questions.length + 1} da prova`}
        title="Nova questão"
      />
      {savedMarker ? (
        <FormMessage type="success" message="Questão adicionada à prova. Escreva a próxima." />
      ) : null}
      <QuestionEditor
        key={`${savedMarker ?? "inicio"}-${type}`}
        isNew
        save={saveQuestionToExam.bind(null, exam.id)}
        cancelHref={`/painel/provas/${exam.id}`}
        saveLabel="Salvar e voltar à prova"
        initial={{ type, stem: "", explanation: "", points: 1, tags: [], options: [] }}
      />
    </div>
  );
}
