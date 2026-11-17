import type { PostgrestError } from "@supabase/supabase-js";

export const GENERIC_SAVE_ERROR = "Não foi possível salvar agora. Tente novamente em instantes.";

/** Códigos do PostgreSQL usados para mensagens específicas. */
const UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(error: Pick<PostgrestError, "code"> | null) {
  return error?.code === UNIQUE_VIOLATION;
}

export type ImportSummary = {
  created: number;
  existing: number;
  linked: number;
  alreadyInClass: number;
};

/** Converte o retorno da função import_students do banco. */
export function toImportSummary(value: unknown): ImportSummary {
  const data = (value ?? {}) as Record<string, unknown>;
  const num = (key: string) => (typeof data[key] === "number" ? (data[key] as number) : 0);
  return {
    created: num("created"),
    existing: num("existing"),
    linked: num("linked"),
    alreadyInClass: num("already_in_class"),
  };
}

export function pluralize(count: number, singular: string, plural: string) {
  return `${count.toLocaleString("pt-BR")} ${count === 1 ? singular : plural}`;
}

/** Frase de resultado da importação, exibida ao professor. */
export function describeImport(summary: ImportSummary): string {
  const parts: string[] = [];
  if (summary.linked > 0) {
    parts.push(`${pluralize(summary.linked, "aluno adicionado", "alunos adicionados")} à turma`);
  }
  if (summary.existing > 0) {
    parts.push(
      `${pluralize(summary.existing, "já estava cadastrado", "já estavam cadastrados")} no seu espaço (nome mantido)`,
    );
  }
  if (summary.alreadyInClass > 0) {
    parts.push(`${pluralize(summary.alreadyInClass, "já estava", "já estavam")} na turma`);
  }
  if (parts.length === 0) return "Nenhum aluno foi importado.";
  return `${parts.join("; ")}.`.replace(/^./, (c) => c.toUpperCase());
}
