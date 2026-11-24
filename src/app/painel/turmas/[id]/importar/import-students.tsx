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
import { rollLabel } from "@/lib/students/roll-order";
import { parseStudentsCsv, type CsvParseResult } from "@/lib/students/csv";
import type { ImportResult } from "../../../actions";

const PREVIEW_LIMIT = 100;

/** Modelo com BOM, para o Excel abrir os acentos corretamente. */
const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(
  "﻿Nome;Número\r\nAna Souza;1\r\nBruno Lima;2\r\n",
)}`;

type Step =
  | { kind: "pick"; error?: string }
  | { kind: "preview"; fileName: string; result: CsvParseResult }
  | { kind: "done"; message: string };

export function ImportStudents({
  classId,
  action,
}: {
  classId: string;
  action: (rows: { fullName: string; registrationCode: string | null }[]) => Promise<ImportResult>;
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
    const text = read.text;
    const result = parseStudentsCsv(text);
    if (result.fatal) {
      setStep({ kind: "pick", error: result.fatal });
      return;
    }
    setSubmitError(undefined);
    setStep({ kind: "preview", fileName: file.name, result });
  }

  function confirmImport(rows: CsvParseResult["rows"]) {
    setSubmitError(undefined);
    startTransition(async () => {
      const response = await action(
        rows.map(({ fullName, registrationCode }) => ({ fullName, registrationCode })),
      );
      if (response.status === "error") {
        setSubmitError(response.message);
      } else {
        setStep({ kind: "done", message: response.message });
      }
    });
  }

  if (step.kind === "done") {
    return (
      <div className="grid max-w-2xl gap-5">
        <FormMessage type="success" message={step.message} />
        <div className="flex flex-wrap gap-2">
          <Link href={`/painel/turmas/${classId}`} className={buttonVariants()}>
            Ver turma
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
    return (
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5 font-mono">
            <FileSpreadsheet className="size-4" aria-hidden />
            {step.fileName}
          </span>
          <span className="inline-flex items-center gap-1.5 text-ok">
            <CircleCheck className="size-4" aria-hidden />
            {pluralize(rows.length, "aluno pronto", "alunos prontos")} para importar
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
            <ul className="grid gap-1 text-sm">
              {errors.map((error) => (
                <li key={error.line} className="flex gap-3">
                  <span className="w-20 shrink-0 font-mono text-muted-foreground">
                    Linha {error.line}
                  </span>
                  <span>{error.message}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="relative overflow-x-auto rounded-md border-[1.5px] border-border bg-card">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr className="border-b-[1.5px] border-foreground text-left">
                  <th
                    scope="col"
                    className="label-mono w-24 px-4 py-2.5 font-normal text-muted-foreground"
                  >
                    Linha
                  </th>
                  <th
                    scope="col"
                    className="label-mono px-4 py-2.5 font-normal text-muted-foreground"
                  >
                    Nome
                  </th>
                  <th
                    scope="col"
                    className="label-mono px-4 py-2.5 font-normal text-muted-foreground"
                  >
                    Nº
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, PREVIEW_LIMIT).map((row) => (
                  <tr key={row.line} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 font-mono text-muted-foreground tabular-nums">
                      {row.line}
                    </td>
                    <td className="px-4 py-2.5">{row.fullName}</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums">
                      {rollLabel(row.registrationCode)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > PREVIEW_LIMIT ? (
              <p className="border-t border-border px-4 py-2.5 text-sm text-muted-foreground">
                e mais {pluralize(rows.length - PREVIEW_LIMIT, "aluno", "alunos")}.
              </p>
            ) : null}
          </div>
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
            {pending ? "Importando…" : `Importar ${pluralize(rows.length, "aluno", "alunos")}`}
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
      hint={
        <>
          Até 500 alunos por arquivo. Colunas: <span className="font-mono">Nome</span> e{" "}
          <span className="font-mono">Número</span>.
        </>
      }
    >
      <h2 className="font-semibold">Como preparar a planilha</h2>
      <ol className="grid list-decimal gap-1.5 pl-5 text-muted-foreground">
        <li>
          Use uma coluna com o título <strong className="text-foreground">Nome</strong> e outra com
          o título <strong className="text-foreground">Número</strong> (nº da chamada; também
          aceitamos Matrícula ou RA). Outras colunas são ignoradas.
        </li>
        <li>
          No Excel ou no Google Planilhas, salve ou baixe como{" "}
          <strong className="text-foreground">CSV</strong>.
        </li>
        <li>Números que já estão na turma não são duplicados.</li>
      </ol>
      <a
        href={TEMPLATE_HREF}
        download="modelo-alunos.csv"
        className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
      >
        <Download aria-hidden />
        Baixar planilha modelo
      </a>
    </CsvFilePicker>
  );
}
