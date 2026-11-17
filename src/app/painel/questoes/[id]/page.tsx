import { Trash2 } from "lucide-react";
import { Suspense } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { FormMessage } from "@/components/form/form-message";
import { PageHeader } from "@/components/page-header";
import { countPublishedExamsUsingQuestion } from "@/lib/exams/queries";
import { getQuestion } from "@/lib/questions/queries";
import { questionTypeInfo } from "@/lib/questions/types";
import { isUuid } from "@/lib/uuid";
import { deleteQuestion, saveQuestion } from "../actions";
import { QuestionEditor } from "../_components/question-editor";

type Props = PageProps<"/painel/questoes/[id]">;

export default function EditQuestionPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
      <EditQuestionContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditQuestionContent({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const fromExam = typeof query.prova === "string" && isUuid(query.prova) ? query.prova : null;
  const [question, publishedUses] = await Promise.all([
    getQuestion(id),
    countPublishedExamsUsingQuestion(id),
  ]);

  return (
    <div className="grid gap-8">
      <title>Editar questão · Avaliações Escolares</title>
      <PageHeader
        back={
          fromExam
            ? { href: `/painel/provas/${fromExam}`, label: "Voltar para a prova" }
            : { href: "/painel/questoes", label: "Banco de questões" }
        }
        eyebrow={questionTypeInfo(question.type).label}
        title="Editar questão"
      />
      {query.erro === "em-uso" ? (
        <FormMessage
          type="error"
          message="Esta questão está em uma ou mais provas e não pode ser excluída. Remova-a das provas em rascunho primeiro; provas publicadas mantêm sua própria cópia."
        />
      ) : null}
      {publishedUses > 0 ? (
        <p className="rounded-md border-[1.5px] border-dashed border-foreground/40 bg-secondary px-4 py-3 text-sm">
          Esta questão está em{" "}
          {publishedUses === 1 ? "uma prova publicada" : `${publishedUses} provas publicadas`}.
          Provas publicadas guardam a própria cópia: as alterações valem só para provas novas ou em
          rascunho.
        </p>
      ) : null}
      <QuestionEditor
        isNew={false}
        save={saveQuestion.bind(null, question.id, fromExam)}
        cancelHref={fromExam ? `/painel/provas/${fromExam}` : "/painel/questoes"}
        initial={{
          type: question.type,
          stem: question.stem,
          explanation: question.explanation ?? "",
          points: question.points,
          tags: question.tags,
          options: question.options,
        }}
      />
      <section
        aria-labelledby="excluir-questao"
        className="grid max-w-2xl gap-3 border-t-[1.5px] border-dashed border-border pt-8"
      >
        <h2 id="excluir-questao" className="text-lg font-semibold">
          Excluir questão
        </h2>
        <p className="text-sm text-muted-foreground">
          Remove a questão do seu banco. Não é possível desfazer. Questões usadas em provas não
          podem ser excluídas.
        </p>
        <div>
          <ConfirmAction
            action={deleteQuestion.bind(null, question.id)}
            label="Excluir questão"
            confirmLabel="Excluir definitivamente"
            question="Excluir esta questão?"
            icon={<Trash2 aria-hidden />}
          />
        </div>
      </section>
    </div>
  );
}
