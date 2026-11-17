import { Trash2 } from "lucide-react";
import { Suspense } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { PageHeader } from "@/components/page-header";
import { getQuestion } from "@/lib/questions/queries";
import { questionTypeInfo } from "@/lib/questions/types";
import { deleteQuestion, saveQuestion } from "../actions";
import { QuestionEditor } from "../_components/question-editor";

export default function EditQuestionPage({ params }: PageProps<"/painel/questoes/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
      <EditQuestionContent params={params} />
    </Suspense>
  );
}

async function EditQuestionContent({ params }: Pick<PageProps<"/painel/questoes/[id]">, "params">) {
  const { id } = await params;
  const question = await getQuestion(id);

  return (
    <div className="grid gap-8">
      <title>Editar questão · Avaliações Escolares</title>
      <PageHeader
        back={{ href: "/painel/questoes", label: "Banco de questões" }}
        eyebrow={questionTypeInfo(question.type).label}
        title="Editar questão"
      />
      <QuestionEditor
        isNew={false}
        save={saveQuestion.bind(null, question.id)}
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
          Remove a questão do seu banco. Não é possível desfazer.
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
