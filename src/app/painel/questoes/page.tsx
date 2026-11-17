import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { FormMessage } from "@/components/form/form-message";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pluralize } from "@/lib/classes/messages";
import { pointsLabel } from "@/lib/questions/points";
import {
  listQuestions,
  listQuestionTags,
  QUESTIONS_PAGE_SIZE,
  type QuestionFilters,
} from "@/lib/questions/queries";
import { isQuestionType, QUESTION_TYPES, questionTypeInfo } from "@/lib/questions/types";
import { cn } from "@/lib/utils";
import { GradingTag } from "./_components/question-editor";

export const metadata: Metadata = { title: "Banco de questões" };

type SearchParams = PageProps<"/painel/questoes">["searchParams"];

function readFilters(params: Awaited<SearchParams>): QuestionFilters & { saved: boolean } {
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
  const page = Number(first(params.pagina) ?? "1");
  const type = first(params.tipo);
  return {
    search: first(params.busca)?.slice(0, 100),
    tag: first(params.assunto)?.slice(0, 40),
    type: isQuestionType(type) ? type : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    saved: first(params.salva) === "1",
  };
}

/** Monta a URL da lista preservando os filtros. */
function listHref(filters: QuestionFilters, changes: Partial<QuestionFilters>) {
  const next = { ...filters, ...changes };
  const params = new URLSearchParams();
  if (next.search) params.set("busca", next.search);
  if (next.type) params.set("tipo", next.type);
  if (next.tag) params.set("assunto", next.tag);
  if (next.page > 1) params.set("pagina", String(next.page));
  const query = params.toString();
  return `/painel/questoes${query ? `?${query}` : ""}`;
}

export default function QuestionsPage({ searchParams }: PageProps<"/painel/questoes">) {
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Banco de questões"
        description="Cadastre questões uma vez e reutilize em várias provas. Na prova, o sistema sorteia as questões e embaralha as alternativas para cada aluno."
        actions={
          <Link href="/painel/questoes/nova" className={buttonVariants()}>
            <Plus aria-hidden />
            Nova questão
          </Link>
        }
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-muted" />}>
        <QuestionsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function QuestionsContent({ searchParams }: { searchParams: SearchParams }) {
  const filters = readFilters(await searchParams);
  const [{ items, total }, tags] = await Promise.all([listQuestions(filters), listQuestionTags()]);
  const pages = Math.max(1, Math.ceil(total / QUESTIONS_PAGE_SIZE));
  const filtered = Boolean(filters.search || filters.type || filters.tag);

  if (total === 0 && !filtered) {
    return (
      <EmptyState
        title="Seu banco de questões está vazio"
        description="Comece cadastrando algumas questões. Você escolhe o tipo, marca o gabarito e define o valor."
      >
        <Link href="/painel/questoes/nova" className={buttonVariants()}>
          <Plus aria-hidden />
          Cadastrar primeira questão
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-6">
      {filters.saved ? <FormMessage type="success" message="Questão salva." /> : null}

      <form
        action="/painel/questoes"
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
            defaultValue={filters.search}
            placeholder="Buscar no enunciado"
            aria-label="Buscar no enunciado"
            className="pl-9"
          />
        </div>
        <select
          name="tipo"
          defaultValue={filters.type ?? ""}
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
        {filters.tag ? <input type="hidden" name="assunto" value={filters.tag} /> : null}
        <Button type="submit" variant="outline" className="h-10">
          Filtrar
        </Button>
      </form>

      {tags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Filtrar por assunto">
          <span className="label-mono text-muted-foreground">Assuntos</span>
          {tags.slice(0, 20).map((tag) => {
            const active = filters.tag === tag;
            return (
              <Link
                key={tag}
                href={listHref(filters, { tag: active ? undefined : tag, page: 1 })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "rounded-sm border-[1.5px] px-2 py-0.5 font-mono text-xs outline-none focus-visible:ring-4 focus-visible:ring-ring",
                  active
                    ? "border-foreground bg-mark"
                    : "border-border bg-card hover:border-foreground/60",
                )}
              >
                {tag}
              </Link>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{pluralize(total, "questão", "questões")}</span>
        {filtered ? (
          <Link
            href="/painel/questoes"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            Limpar filtros
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Nenhuma questão encontrada"
          description="Tente outro termo de busca ou remova algum filtro."
        />
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => {
            const info = questionTypeInfo(item.type);
            return (
              <li key={item.id}>
                <Link
                  href={`/painel/questoes/${item.id}`}
                  className="group grid gap-2 rounded-md border-[1.5px] border-border bg-card p-4 transition-[border-color,box-shadow] outline-none hover:border-foreground hover:shadow-[3px_3px_0_var(--mark)] focus-visible:border-foreground focus-visible:ring-4 focus-visible:ring-ring"
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="label-mono">{info.short}</span>
                      <GradingTag grading={info.grading} />
                    </div>
                    <span className="font-mono text-sm tabular-nums">
                      {pointsLabel(item.points)}
                    </span>
                  </div>
                  <p className="line-clamp-2 leading-relaxed whitespace-pre-line">{item.stem}</p>
                  {item.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-between gap-2" aria-label="Paginação">
          {filters.page > 1 ? (
            <Link
              href={listHref(filters, { page: filters.page - 1 })}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ChevronLeft aria-hidden />
              Anteriores
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-sm text-muted-foreground">
            {filters.page} / {pages}
          </span>
          {filters.page < pages ? (
            <Link
              href={listHref(filters, { page: filters.page + 1 })}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Próximas
              <ChevronRight aria-hidden />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
