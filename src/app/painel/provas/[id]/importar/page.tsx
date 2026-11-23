import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getExamDetail } from "@/lib/exams/queries";
import { importQuestionsToExam } from "../../actions";
import { ImportQuestions } from "./import-questions";

type Props = PageProps<"/painel/provas/[id]/importar">;

export default function ImportQuestionsPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-muted" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const exam = await getExamDetail(id);
  const draft = exam.status === "draft";

  return (
    <div className="grid grid-cols-1 gap-8">
      <title>{`Importar questões · ${exam.title} · Avaliações Escolares`}</title>
      <PageHeader
        back={{ href: `/painel/provas/${exam.id}`, label: exam.title }}
        title="Importar questões da planilha"
        description="Escreva as questões no Excel ou no Google Planilhas e envie todas de uma vez."
      />
      {draft ? (
        <ImportQuestions examId={exam.id} action={importQuestionsToExam.bind(null, exam.id)} />
      ) : (
        <div className="grid max-w-2xl gap-4 rounded-md border-[1.5px] border-dashed border-foreground/40 bg-secondary p-4 text-sm">
          <p>
            <strong>A prova está publicada.</strong> Volte-a para rascunho para incluir questões.
          </p>
          <Link
            href={`/painel/provas/${exam.id}`}
            className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
          >
            Voltar à prova
          </Link>
        </div>
      )}
    </div>
  );
}
