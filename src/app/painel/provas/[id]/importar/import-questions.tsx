"use client";

import {
  CircleAlert,
  CircleCheck,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CsvFilePicker, readCsvFile } from "@/components/csv-file-picker";
import { FormMessage } from "@/components/form/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { pluralize } from "@/lib/classes/messages";
import {
  MAX_IMPORT_QUESTIONS,
  parseQuestionsCsv,
  QUESTIONS_TEMPLATE_CSV,
  type ParsedQuestion,
  type QuestionCsvResult,
} from "@/lib/questions/csv";
import { formatPoints, parsePoints } from "@/lib/questions/points";
import type { QuestionInput } from "@/lib/questions/schema";
import { optionLetter, questionTypeInfo } from "@/lib/questions/types";
import type { ImportQuestionsResult } from "../../actions";

const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(QUESTIONS_TEMPLATE_CSV)}`;

const GUIDE: [string, string][] = [
  [
    "Tipo",
    "Múltipla escolha, Seleção múltipla, Verdadeiro ou falso, Resposta curta ou Dissertativa. Se ficar vazio, deduzimos pelo que foi preenchido.",
  ],
  ["Enunciado", "A pergunta."],
  [
    "A, B, C…",
    "As alternativas (até 10). Na resposta curta, as respostas aceitas; acentos e maiúsculas não importam.",
  ],
  [
    "Correta",
    "A letra certa (B). Na seleção múltipla, todas as certas (A, C). No verdadeiro ou falso, V ou F.",
  ],
  ["Valor", "Pontos da questão (1 se ficar vazio). Aceita 1,5."],
  ["Explicação", "Opcional. Resolução comentada ou, na dissertativa, a resposta esperada."],
];

type Step =
  | { kind: "pick"; error?: string }
  | { kind: "preview"; fileName: string; result: QuestionCsvResult }
  | { kind: "done"; count: number };

/** A linha da planilha só serve para a prévia; o servidor recebe a questão. */
function withoutLine(q: ParsedQuestion): QuestionInput {
  return {
    type: q.type,
    stem: q.stem,
    explanation: q.explanation,
    points: q.points,
    tags: q.tags,
    options: q.options,
  };
}

/** Resumo do gabarito para a prévia. */
function answerSummary(q: ParsedQuestion) {
  switch (q.type) {
    case "essay":
      return "Correção manual";
    case "short_answer":
      return `Aceitas: ${q.options.map((o) => o.body).join(" · ")}`;
    case "true_false":
      return q.options[0]?.isCorrect ? "Correta: Verdadeiro" : "Correta: Falso";
    default: {
      const letters = q.options.flatMap((o, i) => (o.isCorrect ? [optionLetter(i)] : []));
      return `${pluralize(q.options.length, "alternativa", "alternativas")} · Correta: ${letters.join(", ")}`;
    }
  }
}

export function ImportQuestions({
  examId,
  action,
}: {
  examId: string;
  action: (inputs: QuestionInput[]) => Promise<ImportQuestionsResult>;
}) {
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [submitError, setSubmitError] = useState<string>();
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const read = await readCsvFile(file);
    if ("error" in read) {
      setStep({ kind: "pick", error: read.error });
      return;
    }
    const result = parseQuestionsCsv(read.text);
    if (result.fatal) {
      setStep({ kind: "pick", error: result.fatal });
      return;
    }
    setSubmitError(undefined);
    setStep({ kind: "preview", fileName: file.name, result });
  }

  function confirmImport(rows: ParsedQuestion[]) {
    setSubmitError(undefined);
    startTransition(async () => {
      const response = await action(rows.map(withoutLine));
      if (response.status === "error") setSubmitError(response.message);
      else setStep({ kind: "done", count: response.count });
    });
  }

  if (step.kind === "done") {
    return (
      <div className="grid max-w-2xl gap-5">
        <FormMessage
          type="success"
          message={`${pluralize(step.count, "questão importada", "questões importadas")} para a prova. Elas também ficam no seu banco de questões.`}
        />
        <div className="flex flex-wrap gap-2">
          <Link href={`/painel/provas/${examId}`} className={buttonVariants()}>
            Ver a prova
          </Link>
          <Button type="button" variant="outline" onClick={() => setStep({ kind: "pick" })}>
            Importar outro arquivo
          </Button>
        </div>
      </div>
    );
  }

  if (step.kind === "preview") {
    const { rows, errors } = step.result;
    const total = rows.reduce((sum, q) => sum + (parsePoints(q.points) ?? 0), 0);
    return (
      <div className="grid grid-cols-1 gap-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="inline-flex min-w-0 items-center gap-1.5 font-mono">
            <FileSpreadsheet className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{step.fileName}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-ok">
            <CircleCheck className="size-4" aria-hidden />
            {pluralize(rows.length, "questão pronta", "questões prontas")}
            {rows.length > 0 ? ` · ${formatPoints(total)} pontos` : ""}
          </span>
          {errors.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-pen">
              <CircleAlert className="size-4" aria-hidden />
              {pluralize(errors.length, "linha com problema", "linhas com problema")}
            </span>
          ) : null}
        </div>

        {errors.length > 0 ? (
          <div className="grid gap-2 rounded-md border-[1.5px] border-pen/40 bg-pen/5 p-4">
            <p className="text-sm font-medium text-pen">
              Estas linhas serão ignoradas. Corrija a planilha e envie de novo se quiser incluí-las.
            </p>
            <ul className="grid gap-1.5 text-sm">
              {errors.map((error) => (
                <li key={error.line} className="grid gap-x-3 sm:grid-cols-[5rem_1fr]">
                  <span className="font-mono text-muted-foreground">Linha {error.line}</span>
                  <span>{error.message}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <ol className="grid grid-cols-1 gap-2">
            {rows.map((q, index) => (
              <li
                key={q.line}
                className="grid min-w-0 gap-1.5 rounded-md border-[1.5px] border-border bg-card px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
                  <span className="text-foreground">{index + 1}.</span>
                  <span>{questionTypeInfo(q.type).short}</span>
                  <span>{formatPoints(parsePoints(q.points) ?? 0)} pt</span>
                  <span>linha {q.line}</span>
                </div>
                <p className="line-clamp-2 break-words">{q.stem}</p>
                <p className="truncate text-sm text-muted-foreground">{answerSummary(q)}</p>
              </li>
            ))}
          </ol>
        ) : null}

        <FormMessage type="error" message={submitError} />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            disabled={rows.length === 0 || pending}
            onClick={() => confirmImport(rows)}
          >
            {pending ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : (
              <Upload aria-hidden />
            )}
            {pending ? "Importando…" : `Importar ${pluralize(rows.length, "questão", "questões")}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => setStep({ kind: "pick" })}
          >
            Escolher outro arquivo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <CsvFilePicker
      error={step.error}
      onFile={handleFile}
      hint={`Uma questão por linha, até ${MAX_IMPORT_QUESTIONS} por arquivo. Você confere tudo antes de confirmar.`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Como preencher</h2>
        <a
          href={TEMPLATE_HREF}
          download="modelo-prova.csv"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Download aria-hidden />
          Baixar planilha modelo
        </a>
      </div>
      <p className="text-muted-foreground">
        Baixe o modelo, apague os exemplos e escreva suas questões, uma por linha. No Excel, salve
        como <strong className="text-foreground">CSV</strong>.
      </p>
      <dl className="grid rounded-md border-[1.5px] border-border bg-card">
        {GUIDE.map(([column, text]) => (
          <div
            key={column}
            className="grid gap-1 border-b border-border px-3 py-2.5 last:border-b-0 sm:grid-cols-[7rem_1fr] sm:gap-3"
          >
            <dt className="font-mono font-medium">{column}</dt>
            <dd className="text-muted-foreground">{text}</dd>
          </div>
        ))}
      </dl>
    </CsvFilePicker>
  );
}
