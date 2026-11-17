"use client";

import { Check, LoaderCircle, Plus, X } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { FormMessage } from "@/components/form/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPoints } from "@/lib/questions/points";
import { MAX_OPTIONS } from "@/lib/questions/schema";
import {
  GRADING_LABEL,
  QUESTION_TYPES,
  TRUE_FALSE_OPTIONS,
  optionLetter,
  questionTypeInfo,
  type Grading,
  type QuestionType,
} from "@/lib/questions/types";
import { cn } from "@/lib/utils";
import type { SaveQuestionResult } from "../actions";

type Option = { key: number; body: string; isCorrect: boolean };

export type QuestionEditorValues = {
  type: QuestionType;
  stem: string;
  explanation: string;
  points: number;
  tags: string[];
  options: { body: string; isCorrect: boolean }[];
};

type SaveFn = (
  input: {
    type: QuestionType;
    stem: string;
    explanation: string;
    points: string;
    tags: string;
    options: { body: string; isCorrect: boolean }[];
  },
  next: "list" | "new",
) => Promise<SaveQuestionResult>;

let nextKey = 1;
const withKeys = (options: { body: string; isCorrect: boolean }[]): Option[] =>
  options.map((o) => ({ ...o, key: nextKey++ }));
const emptyOptions = (count: number): Option[] =>
  withKeys(Array.from({ length: count }, () => ({ body: "", isCorrect: false })));

export function QuestionEditor({
  initial,
  save,
  isNew,
  cancelHref = "/painel/questoes",
  saveLabel = "Salvar questão",
}: {
  initial: QuestionEditorValues;
  save: SaveFn;
  isNew: boolean;
  cancelHref?: string;
  saveLabel?: string;
}) {
  const [type, setType] = useState<QuestionType>(initial.type);
  const [stem, setStem] = useState(initial.stem);
  const [explanation, setExplanation] = useState(initial.explanation);
  const [points, setPoints] = useState(formatPoints(initial.points));
  const [tags, setTags] = useState(initial.tags.join(", "));
  // Alternativas de escolha e respostas aceitas ficam em listas separadas,
  // para que trocar de tipo não misture os dois conceitos.
  const [choices, setChoices] = useState<Option[]>(() =>
    (initial.type === "single_choice" || initial.type === "multiple_choice") &&
    initial.options.length > 0
      ? withKeys(initial.options)
      : emptyOptions(4),
  );
  const [answers, setAnswers] = useState<Option[]>(() =>
    initial.type === "short_answer" && initial.options.length > 0
      ? withKeys(initial.options)
      : emptyOptions(1),
  );
  const [trueFalse, setTrueFalse] = useState<"true" | "false" | null>(() => {
    if (initial.type !== "true_false") return null;
    const correct = initial.options.findIndex((o) => o.isCorrect);
    return correct === 0 ? "true" : correct === 1 ? "false" : null;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const ids = useId();

  const info = questionTypeInfo(type);

  function changeType(next: QuestionType) {
    if (next === "single_choice" && type === "multiple_choice") {
      // Mantém só a primeira correta ao passar de seleção múltipla para múltipla escolha.
      let found = false;
      setChoices((list) =>
        list.map((o) => {
          const keep = o.isCorrect && !found;
          if (keep) found = true;
          return { ...o, isCorrect: keep };
        }),
      );
    }
    setType(next);
    setErrors({});
  }

  function currentOptions() {
    if (type === "true_false") {
      return TRUE_FALSE_OPTIONS.map((body, index) => ({
        body,
        isCorrect: (index === 0 && trueFalse === "true") || (index === 1 && trueFalse === "false"),
      }));
    }
    if (type === "short_answer") return answers.map(({ body }) => ({ body, isCorrect: true }));
    if (type === "essay") return [];
    return choices.map(({ body, isCorrect }) => ({ body, isCorrect }));
  }

  function submit(next: "list" | "new") {
    setFormError(undefined);
    startTransition(async () => {
      const result = await save(
        { type, stem, explanation, points, tags, options: currentOptions() },
        next,
      );
      // Em caso de sucesso a ação redireciona; aqui só chegam erros.
      setErrors(result.errors);
      setFormError(
        result.message ??
          (Object.keys(result.errors).length > 0 ? "Revise os campos destacados." : undefined),
      );
    });
  }

  return (
    <form
      className="grid gap-8"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit("list");
      }}
    >
      <fieldset className="grid gap-3">
        <legend className="mb-3 text-sm font-medium">Tipo de questão</legend>
        <div
          className="grid grid-cols-2 gap-2 lg:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1"
          role="radiogroup"
        >
          {QUESTION_TYPES.map((option) => {
            const selected = option.type === type;
            return (
              <button
                key={option.type}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => changeType(option.type)}
                className={cn(
                  "grid gap-1 rounded-md border-[1.5px] bg-card px-3 py-2.5 text-left transition-[border-color,box-shadow] outline-none focus-visible:ring-4 focus-visible:ring-ring",
                  selected
                    ? "border-foreground shadow-[3px_3px_0_var(--mark)]"
                    : "border-border hover:border-foreground/60",
                )}
              >
                <span className="text-sm font-semibold">{option.label}</span>
                <GradingTag grading={option.grading} />
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">{info.description}</p>
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor={`${ids}-stem`}>Enunciado</Label>
        <Textarea
          id={`${ids}-stem`}
          value={stem}
          onChange={(e) => setStem(e.target.value)}
          placeholder={
            type === "true_false"
              ? "Escreva a afirmação que o aluno vai julgar."
              : "Escreva a pergunta como o aluno vai ler."
          }
          maxLength={5000}
          aria-invalid={errors.stem ? true : undefined}
          aria-describedby={errors.stem ? `${ids}-stem-erro` : undefined}
          className="min-h-28 text-base"
        />
        <FieldError id={`${ids}-stem-erro`} message={errors.stem} />
      </div>

      <section className="grid gap-3" aria-labelledby={`${ids}-answers`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={`${ids}-answers`} className="text-sm font-medium">
            {type === "short_answer"
              ? "Respostas aceitas"
              : type === "true_false"
                ? "Gabarito"
                : type === "essay"
                  ? "Correção"
                  : "Alternativas"}
          </h2>
          {type === "single_choice" || type === "multiple_choice" ? (
            <span className="text-xs text-muted-foreground">
              {type === "single_choice"
                ? "Marque a alternativa correta."
                : "Marque todas as corretas."}{" "}
              A ordem é sorteada para cada aluno.
            </span>
          ) : null}
        </div>

        {type === "single_choice" || type === "multiple_choice" ? (
          <ChoiceList
            options={choices}
            setOptions={setChoices}
            multiple={type === "multiple_choice"}
            errors={errors}
          />
        ) : null}

        {type === "true_false" ? (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="A afirmação é">
            {(["true", "false"] as const).map((value, index) => {
              const selected = trueFalse === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTrueFalse(value)}
                  className={cn(
                    "inline-flex h-11 min-w-36 items-center justify-center gap-2 rounded-md border-[1.5px] px-4 text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-ring",
                    selected
                      ? "border-foreground bg-foreground text-background shadow-[3px_3px_0_var(--mark)]"
                      : "border-border bg-card hover:border-foreground/60",
                  )}
                >
                  {selected ? <Check className="size-4" aria-hidden /> : null}
                  {TRUE_FALSE_OPTIONS[index]}
                </button>
              );
            })}
          </div>
        ) : null}

        {type === "short_answer" ? (
          <AnswerList options={answers} setOptions={setAnswers} errors={errors} />
        ) : null}

        {type === "essay" ? (
          <p className="rounded-md border-[1.5px] border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            O aluno responde em texto livre e{" "}
            <strong className="text-foreground">você corrige</strong> atribuindo a nota. Use o campo
            abaixo para anotar a resposta esperada.
          </p>
        ) : null}

        <FieldError message={errors.options} />
      </section>

      <div className="grid gap-2">
        <Label htmlFor={`${ids}-explanation`}>
          {type === "essay" ? "Resposta esperada e critérios" : "Resolução comentada"}{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id={`${ids}-explanation`}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          maxLength={5000}
          className="min-h-20"
          aria-describedby={`${ids}-explanation-dica`}
        />
        <p id={`${ids}-explanation-dica`} className="text-xs text-muted-foreground">
          Visível só para você.
        </p>
        <FieldError message={errors.explanation} />
      </div>

      <div className="grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          <Label htmlFor={`${ids}-points`}>Valor padrão</Label>
          <div className="flex items-center gap-2">
            <Input
              id={`${ids}-points`}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              inputMode="decimal"
              className="w-20 font-mono"
              aria-invalid={errors.points ? true : undefined}
            />
            <span className="text-sm text-muted-foreground">pontos</span>
          </div>
          <FieldError message={errors.points} />
        </div>
        <div className="grid content-start gap-2">
          <Label htmlFor={`${ids}-tags`}>Assuntos</Label>
          <Input
            id={`${ids}-tags`}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="frações, 7º ano"
            aria-describedby={`${ids}-tags-dica`}
            aria-invalid={errors.tags ? true : undefined}
          />
          <p id={`${ids}-tags-dica`} className="text-xs text-muted-foreground">
            Separe por vírgula. Ajudam a encontrar a questão depois.
          </p>
          <FieldError message={errors.tags} />
        </div>
      </div>

      <FormMessage type="error" message={formError} />

      <div className="flex flex-wrap items-center gap-2 border-t-[1.5px] border-dashed border-border pt-6">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          {saveLabel}
        </Button>
        {isNew ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => submit("new")}
          >
            Salvar e criar outra
          </Button>
        ) : null}
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost", size: "lg" })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

export function GradingTag({ grading, className }: { grading: Grading; className?: string }) {
  return (
    <span
      className={cn(
        "label-mono inline-flex items-center gap-1.5 text-[0.65rem]",
        grading === "manual" ? "text-pen" : "text-ok",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", grading === "manual" ? "bg-pen" : "bg-ok")}
      />
      {GRADING_LABEL[grading]}
    </span>
  );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  );
}

function ChoiceList({
  options,
  setOptions,
  multiple,
  errors,
}: {
  options: Option[];
  setOptions: React.Dispatch<React.SetStateAction<Option[]>>;
  multiple: boolean;
  errors: Record<string, string>;
}) {
  function toggleCorrect(key: number) {
    setOptions((list) =>
      list.map((o) =>
        multiple
          ? o.key === key
            ? { ...o, isCorrect: !o.isCorrect }
            : o
          : { ...o, isCorrect: o.key === key },
      ),
    );
  }

  return (
    <div className="grid gap-2">
      <ol className="grid gap-2">
        {options.map((option, index) => {
          const error = errors[`options.${index}.body`];
          const letter = optionLetter(index);
          return (
            <li key={option.key} className="grid gap-1">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md border-[1.5px] bg-card py-1.5 pr-1.5 pl-2",
                  option.isCorrect ? "border-ok" : "border-border",
                )}
              >
                <button
                  type="button"
                  role={multiple ? "checkbox" : "radio"}
                  aria-checked={option.isCorrect}
                  aria-label={`Marcar alternativa ${letter} como correta`}
                  onClick={() => toggleCorrect(option.key)}
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center border-[1.5px] font-mono text-sm font-medium outline-none focus-visible:ring-4 focus-visible:ring-ring",
                    multiple ? "rounded-sm" : "rounded-full",
                    option.isCorrect
                      ? "border-ok bg-ok text-white"
                      : "border-foreground/70 hover:bg-secondary",
                  )}
                >
                  {option.isCorrect ? (
                    <Check className="size-4" strokeWidth={3} aria-hidden />
                  ) : (
                    letter
                  )}
                </button>
                <Input
                  aria-label={`Alternativa ${letter}`}
                  value={option.body}
                  onChange={(e) =>
                    setOptions((list) =>
                      list.map((o) => (o.key === option.key ? { ...o, body: e.target.value } : o)),
                    )
                  }
                  maxLength={1000}
                  aria-invalid={error ? true : undefined}
                  className="h-9 border-transparent bg-transparent px-1 focus-visible:ring-2"
                />
                {option.isCorrect ? (
                  <span className="label-mono hidden text-[0.65rem] text-ok sm:inline">
                    Correta
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover alternativa ${letter}`}
                  disabled={options.length <= 2}
                  onClick={() => setOptions((list) => list.filter((o) => o.key !== option.key))}
                >
                  <X aria-hidden />
                </Button>
              </div>
              <FieldError message={error} />
            </li>
          );
        })}
      </ol>
      {options.length < MAX_OPTIONS ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => setOptions((list) => [...list, ...emptyOptions(1)])}
        >
          <Plus aria-hidden />
          Adicionar alternativa
        </Button>
      ) : null}
    </div>
  );
}

function AnswerList({
  options,
  setOptions,
  errors,
}: {
  options: Option[];
  setOptions: React.Dispatch<React.SetStateAction<Option[]>>;
  errors: Record<string, string>;
}) {
  return (
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {options.map((option, index) => {
          const error = errors[`options.${index}.body`];
          return (
            <li key={option.key} className="grid gap-1">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Resposta aceita ${index + 1}`}
                  value={option.body}
                  onChange={(e) =>
                    setOptions((list) =>
                      list.map((o) => (o.key === option.key ? { ...o, body: e.target.value } : o)),
                    )
                  }
                  placeholder={index === 0 ? "Ex.: Brasília" : "Outra forma aceita"}
                  maxLength={1000}
                  aria-invalid={error ? true : undefined}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover resposta ${index + 1}`}
                  disabled={options.length <= 1}
                  onClick={() => setOptions((list) => list.filter((o) => o.key !== option.key))}
                >
                  <X aria-hidden />
                </Button>
              </div>
              <FieldError message={error} />
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        A comparação ignora maiúsculas, acentos e espaços extras, e trata 0,5 e 0.5 como iguais.
        Cadastre outras formas aceitas (ex.: &quot;Brasília&quot; e &quot;Brasília DF&quot;). Você
        poderá revisar a correção depois.
      </p>
      {options.length < MAX_OPTIONS ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => setOptions((list) => [...list, ...emptyOptions(1)])}
        >
          <Plus aria-hidden />
          Adicionar outra resposta aceita
        </Button>
      ) : null}
    </div>
  );
}
