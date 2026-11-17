import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { pluralize } from "@/lib/classes/messages";
import { getExamDetail } from "@/lib/exams/queries";
import { summarizeExam } from "@/lib/exams/rules";
import { formatPoints } from "@/lib/questions/points";
import { questionTypeInfo } from "@/lib/questions/types";
import { PublishButton } from "./publish-button";

type Props = PageProps<"/painel/provas/[id]/publicar">;

export default function PublishPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const exam = await getExamDetail(id);
  if (exam.status !== "draft") notFound();

  const summary = summarizeExam({
    questionsPerAttempt: exam.questionsPerAttempt,
    points: exam.questions.map((q) => q.points),
  });
  const manual = exam.questions.filter((q) => questionTypeInfo(q.type).grading === "manual").length;

  const checklist = [
    `${pluralize(exam.questions.length, "questão", "questões")} na prova; cada aluno recebe ${pluralize(summary.perAttempt, "questão", "questões")}${summary.perAttempt < exam.questions.length ? " sorteadas" : ""}.`,
    summary.studentTotal === null
      ? "Nota máxima indefinida."
      : `Nota máxima de cada aluno: ${formatPoints(summary.studentTotal)} pontos.`,
    exam.timeLimitMinutes
      ? `Tempo máximo: ${exam.timeLimitMinutes} minutos.`
      : "Sem limite de tempo.",
    exam.resultVisibility === "score_only"
      ? "Ao enviar, o aluno vê só a nota."
      : "Ao enviar, o aluno vê a nota e as respostas corretas.",
    manual > 0
      ? `${pluralize(manual, "questão dissertativa precisa", "questões dissertativas precisam")} da sua correção; a nota final sai depois dela.`
      : "Todas as questões têm correção automática: a nota sai na hora.",
    exam.shuffleQuestions || exam.shuffleOptions
      ? `Embaralha ${[exam.shuffleQuestions ? "questões" : null, exam.shuffleOptions ? "alternativas" : null].filter(Boolean).join(" e ")} para cada aluno.`
      : "Mesma ordem para todos os alunos.",
  ];

  return (
    <div className="grid max-w-2xl gap-8">
      <title>{`Publicar ${exam.title} · Avaliações Escolares`}</title>
      <PageHeader
        back={{ href: `/painel/provas/${exam.id}`, label: exam.title }}
        title="Revisar e publicar"
        description="Ao publicar, as questões, os valores e as regras ficam travados. Depois você aplica a prova nas turmas."
      />

      <ul className="bg-graph grid gap-3 rounded-md border-[1.5px] border-foreground p-5">
        {checklist.map((item) => (
          <li key={item} className="flex gap-3">
            <span aria-hidden className="mt-0.5 font-mono text-ok">
              ✓
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {summary.issues.length > 0 ? (
        <div className="grid gap-1.5 rounded-md border-[1.5px] border-pen/40 bg-pen/5 p-4 text-sm text-pen">
          <p className="font-medium">Corrija antes de publicar:</p>
          <ul className="grid list-disc gap-1 pl-4">
            {summary.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <PublishButton examId={exam.id} disabled={summary.issues.length > 0} />
    </div>
  );
}
