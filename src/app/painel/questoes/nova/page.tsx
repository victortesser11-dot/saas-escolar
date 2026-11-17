import type { Metadata } from "next";
import { Suspense } from "react";
import { FormMessage } from "@/components/form/form-message";
import { PageHeader } from "@/components/page-header";
import { isQuestionType } from "@/lib/questions/types";
import { saveQuestion } from "../actions";
import { QuestionEditor } from "../_components/question-editor";

export const metadata: Metadata = { title: "Nova questão" };

export default function NewQuestionPage({ searchParams }: PageProps<"/painel/questoes/nova">) {
  return (
    <div className="grid gap-8">
      <PageHeader
        back={{ href: "/painel/questoes", label: "Banco de questões" }}
        title="Nova questão"
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
        <NewQuestionContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewQuestionContent({
  searchParams,
}: Pick<PageProps<"/painel/questoes/nova">, "searchParams">) {
  const params = await searchParams;
  const requested = Array.isArray(params.tipo) ? params.tipo[0] : params.tipo;
  const type = isQuestionType(requested) ? requested : "single_choice";
  const savedMarker = Array.isArray(params.salva) ? params.salva[0] : params.salva;
  const savedPrevious = Boolean(savedMarker);

  return (
    <div className="grid gap-6">
      {savedPrevious ? (
        <FormMessage type="success" message="Questão salva. Cadastre a próxima." />
      ) : null}
      {/* key: reinicia o editor a cada "Salvar e criar outra". */}
      <QuestionEditor
        key={`${savedMarker ?? "inicio"}-${type}`}
        isNew
        save={saveQuestion.bind(null, null, null)}
        initial={{ type, stem: "", explanation: "", points: 1, tags: [], options: [] }}
      />
    </div>
  );
}
