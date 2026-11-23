import Papa from "papaparse";
import { rollKey } from "./registration-code";
import { studentSchema, type StudentInput } from "./validation";

/** Limite por importação (o mesmo da função import_students no banco). */
export const MAX_IMPORT_ROWS = 500;

export type ParsedRow = StudentInput & { line: number };
export type RowError = { line: number; message: string };

export type CsvParseResult = {
  rows: ParsedRow[];
  errors: RowError[];
  /** Problema que impede a importação inteira (arquivo vazio, colunas não encontradas…). */
  fatal?: string;
};

const NAME_HEADERS = ["nome", "nomecompleto", "aluno", "nomedoaluno", "estudante", "name"];
const CODE_HEADERS = [
  "matricula",
  "numerodematricula",
  "ra",
  "registroacademico",
  "codigo",
  "id",
  "identificacao",
  "numero",
  "n",
  "no",
  "num",
  "chamada",
  "numerodachamada",
  "numeronaturma",
];

/** "Matrícula " → "matricula" (sem acentos, espaços ou pontuação). */
export function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Decodifica o arquivo como UTF-8 e, se houver bytes inválidos, como Windows-1252
 * (codificação do "CSV (separado por vírgulas)" do Excel em português).
 */
export function decodeCsvBytes(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

function findColumns(header: string[]) {
  const normalized = header.map(normalizeHeader);
  const nameIndex = normalized.findIndex((h) => NAME_HEADERS.includes(h));
  const codeIndex = normalized.findIndex((h) => CODE_HEADERS.includes(h));
  return { nameIndex, codeIndex };
}

/**
 * Lê o CSV de alunos. Aceita vírgula ou ponto e vírgula, com ou sem cabeçalho.
 * Com cabeçalho, procura colunas de nome e número pelos títulos usuais.
 * Sem cabeçalho, assume: 1ª coluna = nome, 2ª coluna = número (chamada ou matrícula).
 */
export function parseStudentsCsv(text: string): CsvParseResult {
  const parsed = Papa.parse<string[]>(text.trim(), {
    skipEmptyLines: "greedy",
    delimitersToGuess: [";", ",", "\t"],
  });

  const table = parsed.data.filter((row) => row.some((cell) => cell.trim() !== ""));
  if (table.length === 0) {
    return { rows: [], errors: [], fatal: "O arquivo está vazio." };
  }

  // Regras:
  // 1. 1ª linha com títulos reconhecidos → usa essas colunas.
  // 2. 1ª linha sem nenhum número (parece título), mas não reconhecida → pede os títulos.
  // 3. 1ª linha com números (já é um aluno) → sem cabeçalho: coluna 1 = nome, 2 = número.
  let { nameIndex, codeIndex } = findColumns(table[0]);
  let firstDataRow = 1;

  if (nameIndex === -1 || codeIndex === -1) {
    const firstRowHasDigits = table[0].some((cell) => /\d/.test(cell));
    if (!firstRowHasDigits) {
      return {
        rows: [],
        errors: [],
        fatal: 'Não encontramos as colunas de nome e número. Use os títulos "Nome" e "Número".',
      };
    }
    if (table[0].length < 2) {
      return {
        rows: [],
        errors: [],
        fatal: "O arquivo precisa ter duas colunas: nome do aluno e número.",
      };
    }
    nameIndex = 0;
    codeIndex = 1;
    firstDataRow = 0;
  }

  const dataRows = table.slice(firstDataRow);
  if (dataRows.length === 0) {
    return { rows: [], errors: [], fatal: "Nenhum aluno encontrado no arquivo." };
  }
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      rows: [],
      errors: [],
      fatal: `O arquivo tem ${dataRows.length} alunos. Importe no máximo ${MAX_IMPORT_ROWS} por vez.`,
    };
  }

  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  const seenCodes = new Map<string, number>();

  dataRows.forEach((cells, index) => {
    const line = index + firstDataRow + 1;
    const result = studentSchema.safeParse({
      fullName: cells[nameIndex] ?? "",
      registrationCode: cells[codeIndex] ?? "",
    });

    if (!result.success) {
      errors.push({ line, message: result.error.issues[0]?.message ?? "Linha inválida." });
      return;
    }

    const duplicateOf = seenCodes.get(rollKey(result.data.registrationCode));
    if (duplicateOf) {
      errors.push({
        line,
        message: `Número ${result.data.registrationCode} repetido (já aparece na linha ${duplicateOf}).`,
      });
      return;
    }

    seenCodes.set(rollKey(result.data.registrationCode), line);
    rows.push({ ...result.data, line });
  });

  return { rows, errors };
}
