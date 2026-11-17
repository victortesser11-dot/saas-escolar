import { Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/form/submit-button";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getExamDetail } from "@/lib/exams/queries";
import { pointsLabel } from "@/lib/questions/points";
import { listQuestions } from "@/lib/questions/queries";
import { isQuestionType, QUESTION_TYPES, questionTypeInfo } from "@/lib/questions/types";
import { addQuestionsFromBank } from "../../actions";

type Props = PageProps<"/painel/provas/[id]/banco">;

export default function BankPickerPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

async function Content({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const exam = await getExamDetail(id);
  if (exam.status !== "draft") notFound();

  const type = first(query.tipo);
  const search = first(query.busca)?.slice(0, 100);
  // Mostra as mais recentes; a busca encontra as demais quando o banco for grande.
  const { items, total } = await listQuestions({
    search,
    type: isQuestionType(type) ? type : undefined,
    page: 1,
  });
  const inExam = new Set(exam.questions.map((q) => q.questionId));

  return (
    <div className="grid gap-8">
      <title>{`Trazer do banco · ${exam.title} · Avaliações Escolares`}</title>
      <PageHeader
        back={{ href: `/painel/provas/${exam.id}`, label: exam.title }}
        title="Trazer do banco"
        description="Marque as questões que já estão no seu banco para incluir nesta prova."
      />

      <form
        className="grid gap-3 rounded-md border-[1.5px] border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto]"
        role="search"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="busca"
            type="search"
            defaultValue={search}
            placeholder="Buscar no enunciado"
            aria-label="Buscar no enunciado"
            className="pl-9"
          />
        </div>
        <select
          name="tipo"
          defaultValue={isQuestionType(type) ? type : ""}
          aria-label="Tipo de questão"
          className="h-10 rounded-md border-[1.5px] border-input bg-card px-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring"
        >
          <option value="">Todos os tipos</option>
          {QUESTION_TYPES.map((info) => (
            <option key={info.type} value={info.type}>
              {info.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" className="h-10">
          Filtrar
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={
            total === 0 && !search && !type ? "Seu banco está vazio" : "Nenhuma questão encontrada"
          }
          description="Escreva a questão direto na prova; ela também fica guardada no banco."
        >
          <Link href={`/painel/provas/${exam.id}/questoes/nova`} className={buttonVariants()}>
            Escrever questão
          </Link>
        </EmptyState>
      ) : (
        <form action={addQuestionsFromBank.bind(null, exam.id)} className="grid gap-4">
          <ul className="grid gap-2">
            {items.map((item) => {
              const already = inExam.has(item.id);
              const info = questionTypeInfo(item.type);
              return (
                <li key={item.id}>
                  <label
                    className={
                      already
                        ? "flex gap-3 rounded-md border-[1.5px] border-dashed border-border p-4 opacity-60"
                        : "flex cursor-pointer gap-3 rounded-md border-[1.5px] border-border bg-card p-4 has-checked:border-foreground has-checked:shadow-[3px_3px_0_var(--mark)]"
                    }
                  >
                    <input
                      type="checkbox"
                      name="questionIds"
                      value={item.id}
                      disabled={already}
                      defaultChecked={false}
                      className="mt-1 size-4 shrink-0 accent-foreground"
                      aria-label={`Incluir: ${item.stem.slice(0, 80)}`}
                    />
                    <span className="grid min-w-0 flex-1 gap-1.5">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="label-mono">{info.short}</span>
                        <span className="font-mono text-sm">
                          {already ? "Já está na prova" : pointsLabel(item.points)}
                        </span>
                      </span>
                      <span className="line-clamp-2 leading-relaxed break-words">{item.stem}</span>
                      {item.tags.length > 0 ? (
                        <span className="flex flex-wrap gap-1.5">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {total > items.length ? (
            <p className="text-sm text-muted-foreground">
              Mostrando {items.length} de {total}. Use a busca para encontrar outras.
            </p>
          ) : null}
          <div className="sticky bottom-4 flex flex-wrap gap-2">
            <div className="w-full max-w-64">
              <SubmitButton pendingLabel="Adicionando…">Adicionar selecionadas</SubmitButton>
            </div>
            <Link
              href={`/painel/provas/${exam.id}`}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
