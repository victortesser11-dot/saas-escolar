import Papa from "papaparse";
import { normalizeHeader } from "@/lib/students/csv";
import { MAX_OPTIONS, questionSchema, type QuestionInput } from "./schema";
import { normalizeShortAnswer } from "./short-answer";
import { optionLetter, type QuestionType } from "./types";

/*
 * Planilha de questões (uma por linha). Colunas reconhecidas pelo título:
 * Tipo · Enunciado · A, B, C… (alternativas) · Correta · Valor · Explicação · Assuntos.
 * O tipo pode ficar vazio: é deduzido pelas colunas preenchidas.
 */

export const MAX_IMPORT_QUESTIONS = 100;

export type ParsedQuestion = QuestionInput & { line: number };
export type QuestionRowError = { line: number; message: string };
export type QuestionCsvResult = {
  rows: ParsedQuestion[];
  errors: QuestionRowError[];
  fatal?: string;
};

/** Modelo com um exemplo de cada tipo (BOM para o Excel abrir os acentos). */
export const QUESTIONS_TEMPLATE_CSV =
  "﻿" +
  [
    "Tipo;Enunciado;A;B;C;D;E;Correta;Valor;Explicação",
    "Múltipla escolha;Quanto é 3/4 + 1/4?;1/2;1;3/8;7/4;;B;1;3/4 + 1/4 = 4/4 = 1.",
    "Seleção múltipla;Quais números são primos?;2;4;7;9;;A, C;1;",
    "Verdadeiro ou falso;Todo número par é divisível por 2.;;;;;;V;1;",
    "Resposta curta;Qual é a capital do Brasil?;Brasília;;;;;;1;",
    "Dissertativa;Explique com suas palavras o que é uma fração.;;;;;;;2;Parte de um todo dividido em partes iguais.",
  ].join("\r\n") +
  "\r\n";

const HEADERS = {
  type: ["tipo", "tipodequestao", "tipodaquestao"],
  stem: ["enunciado", "pergunta", "questao", "texto"],
  correct: [
    "correta",
    "corretas",
    "gabarito",
    "resposta",
    "respostacorreta",
    "certa",
    "alternativacorreta",
  ],
  points: ["valor", "pontos", "pontuacao", "peso", "nota"],
  explanation: [
    "explicacao",
    "resolucao",
    "resolucaocomentada",
    "comentario",
    "justificativa",
    "respostaesperada",
  ],
  tags: ["assunto", "assuntos", "conteudo", "tema", "tags"],
} as const;

const OPTION_HEADER = /^(?:alternativa|alt|opcao|letra)?([a-j])$/;

const TYPE_ALIASES: Record<string, QuestionType> = {
  multiplaescolha: "single_choice",
  multipla: "single_choice",
  me: "single_choice",
  objetiva: "single_choice",
  escolhaunica: "single_choice",
  unica: "single_choice",
  selecaomultipla: "multiple_choice",
  variascorretas: "multiple_choice",
  multiplascorretas: "multiple_choice",
  sm: "multiple_choice",
  verdadeirooufalso: "true_false",
  verdadeirofalso: "true_false",
  vf: "true_false",
  certoouerrado: "true_false",
  ce: "true_false",
  respostacurta: "short_answer",
  curta: "short_answer",
  rc: "short_answer",
  lacuna: "short_answer",
  completar: "short_answer",
  dissertativa: "essay",
  discursiva: "essay",
  aberta: "essay",
};

const TRUE_VALUES = new Set(["v", "verdadeiro", "verdadeira", "c", "certo", "certa", "sim"]);
const FALSE_VALUES = new Set(["f", "falso", "falsa", "e", "errado", "errada", "nao"]);

/** "A, C" · "A e C" · "AC" · "Letra B" → ["A", "C"]; null se não parecer uma lista de letras. */
export function parseLetters(raw: string): string[] | null {
  const text = raw
    .toUpperCase()
    .replace(/ALTERNATIVAS?|LETRAS?/g, " ")
    .replace(/\s+E\s+/g, ",")
    .trim();
  if (text === "") return [];
  const tokens = text.split(/[^A-Z]+/).filter(Boolean);
  const valid = (token: string) => /^[A-J]+$/.test(token);
  if (!tokens.every(valid)) return null;
  // "AC" (sem separador) também vale como A e C.
  const letters = tokens.flatMap((token) => (token.length > 1 ? token.split("") : [token]));
  return [...new Set(letters)];
}

function trueFalse(raw: string): boolean | null {
  const key = normalizeHeader(raw);
  if (TRUE_VALUES.has(key)) return true;
  if (FALSE_VALUES.has(key)) return false;
  return null;
}

function findColumns(header: string[]) {
  const normalized = header.map(normalizeHeader);
  const index = (names: readonly string[]) => normalized.findIndex((h) => names.includes(h));
  const options = new Map<number, number>();
  normalized.forEach((h, i) => {
    if ((HEADERS.correct as readonly string[]).includes(h)) return;
    const match = OPTION_HEADER.exec(h);
    if (match) options.set(match[1].charCodeAt(0) - 97, i);
  });
  return {
    type: index(HEADERS.type),
    stem: index(HEADERS.stem),
    correct: index(HEADERS.correct),
    points: index(HEADERS.points),
    explanation: index(HEADERS.explanation),
    tags: index(HEADERS.tags),
    options,
  };
}

type Columns = ReturnType<typeof findColumns>;

/** Uma linha da planilha → questão (ainda não validada) ou mensagem de erro. */
function rowToQuestion(cells: string[], columns: Columns): QuestionInput | string {
  const cell = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
  const stem = cell(columns.stem);
  const correct = cell(columns.correct);

  const optionValues: string[] = [];
  for (let i = 0; i < MAX_OPTIONS; i++) {
    const col = columns.options.get(i);
    optionValues.push(col === undefined ? "" : cell(col));
  }
  const lastFilled = optionValues.findLastIndex((v) => v !== "");
  const bodies = optionValues.slice(0, lastFilled + 1);

  const rawType = cell(columns.type);
  let type: QuestionType | undefined;
  if (rawType) {
    type = TYPE_ALIASES[normalizeHeader(rawType)];
    if (!type) {
      return `Tipo "${rawType}" não reconhecido. Use: Múltipla escolha, Seleção múltipla, Verdadeiro ou falso, Resposta curta ou Dissertativa.`;
    }
  } else if (bodies.length > 0) {
    const letters = parseLetters(correct);
    type =
      letters && letters.length > 1
        ? "multiple_choice"
        : letters
          ? "single_choice"
          : "short_answer";
  } else if (correct && trueFalse(correct) !== null) {
    type = "true_false";
  } else {
    type = correct ? "short_answer" : "essay";
  }

  let options: QuestionInput["options"] = [];
  if (type === "single_choice" || type === "multiple_choice") {
    const letters = parseLetters(correct);
    if (!letters || letters.length === 0) {
      return "Na coluna Correta, informe a letra da alternativa certa (ex.: B).";
    }
    if (type === "single_choice" && letters.length > 1) {
      return 'Múltipla escolha tem uma só alternativa correta. Para mais de uma, use o tipo "Seleção múltipla".';
    }
    const missing = letters.find((l) => !bodies[l.charCodeAt(0) - 65]);
    if (missing) return `A alternativa ${missing}, marcada como correta, está vazia.`;
    options = bodies.map((body, i) => ({ body, isCorrect: letters.includes(optionLetter(i)) }));
  } else if (type === "true_false") {
    const value = trueFalse(correct);
    if (value === null) return "Na coluna Correta, escreva V (verdadeiro) ou F (falso).";
    options = [
      { body: "Verdadeiro", isCorrect: value },
      { body: "Falso", isCorrect: !value },
    ];
  } else if (type === "short_answer") {
    const answers = [
      ...bodies.filter(Boolean),
      ...(correct
        ? correct
            .split(";")
            .map((a) => a.trim())
            .filter(Boolean)
        : []),
    ];
    // A correção ignora acentos e maiúsculas: "Brasília" e "brasilia" são a mesma resposta.
    const unique = new Map<string, string>();
    for (const answer of answers) {
      const key = normalizeShortAnswer(answer);
      if (!unique.has(key)) unique.set(key, answer);
    }
    options = [...unique.values()].map((body) => ({ body, isCorrect: true }));
  }

  return {
    type,
    stem,
    explanation: cell(columns.explanation),
    points: cell(columns.points) || "1",
    tags: cell(columns.tags),
    options,
  };
}

function describeIssue(path: PropertyKey[], message: string) {
  if (path[0] === "options" && typeof path[1] === "number") {
    return `Alternativa ${optionLetter(path[1])}: ${message}`;
  }
  if (path[0] === "points") return `Valor: ${message}`;
  return message;
}

export function parseQuestionsCsv(text: string): QuestionCsvResult {
  const parsed = Papa.parse<string[]>(text.trim(), {
    skipEmptyLines: "greedy",
    delimitersToGuess: [";", ",", "\t"],
  });
  const table = parsed.data;
  if (table.length === 0) return { rows: [], errors: [], fatal: "O arquivo está vazio." };

  const columns = findColumns(table[0]);
  if (columns.stem === -1) {
    return {
      rows: [],
      errors: [],
      fatal:
        'Não encontramos a coluna "Enunciado". Use a planilha modelo: ela já vem com os títulos certos.',
    };
  }
  if (columns.correct === -1 && columns.options.size === 0 && columns.type === -1) {
    return {
      rows: [],
      errors: [],
      fatal: 'Faltam as colunas de alternativas (A, B, C…) e "Correta". Use a planilha modelo.',
    };
  }

  const dataRows = table
    .map((cells, index) => ({ cells, line: index + 1 }))
    .slice(1)
    .filter(({ cells }) => cells.some((c) => c.trim() !== ""));
  if (dataRows.length === 0) return { rows: [], errors: [], fatal: "Nenhuma questão no arquivo." };
  if (dataRows.length > MAX_IMPORT_QUESTIONS) {
    return {
      rows: [],
      errors: [],
      fatal: `O arquivo tem ${dataRows.length} questões. Importe no máximo ${MAX_IMPORT_QUESTIONS} por vez.`,
    };
  }

  const rows: ParsedQuestion[] = [];
  const errors: QuestionRowError[] = [];
  for (const { cells, line } of dataRows) {
    const question = rowToQuestion(cells, columns);
    if (typeof question === "string") {
      errors.push({ line, message: question });
      continue;
    }
    const result = questionSchema.safeParse(question);
    if (!result.success) {
      const issue = result.error.issues[0];
      errors.push({
        line,
        message: describeIssue(issue?.path ?? [], issue?.message ?? "Linha inválida."),
      });
      continue;
    }
    rows.push({ ...question, line });
  }
  return { rows, errors };
}
