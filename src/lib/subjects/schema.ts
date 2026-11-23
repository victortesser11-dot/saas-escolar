import { z } from "zod";

/** "  matemática   aplicada " → "Matemática aplicada" (primeira letra maiúscula). */
export function normalizeSubjectName(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim();
  return name.charAt(0).toLocaleUpperCase("pt-BR") + name.slice(1);
}

export const SUBJECT_NAME_MAX = 60;

export const subjectNameSchema = z
  .string({ error: "Informe a disciplina." })
  .transform(normalizeSubjectName)
  .pipe(
    z
      .string()
      .min(1, { error: "Informe a disciplina." })
      .max(SUBJECT_NAME_MAX, {
        error: `O nome da disciplina pode ter no máximo ${SUBJECT_NAME_MAX} caracteres.`,
      }),
  );

/** Disciplina opcional (campo vazio = sem disciplina). */
export const optionalSubjectSchema = z
  .string()
  .transform(normalizeSubjectName)
  .pipe(
    z.string().max(SUBJECT_NAME_MAX, {
      error: `O nome da disciplina pode ter no máximo ${SUBJECT_NAME_MAX} caracteres.`,
    }),
  )
  .transform((value) => (value === "" ? null : value));

/**
 * Lista digitada pelo professor ("Matemática, Ciências; Geografia") → nomes únicos.
 * Separadores: vírgula, ponto e vírgula ou quebra de linha.
 */
export function parseSubjectList(raw: string): { names: string[]; error?: string } {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of raw.split(/[,;\n]/)) {
    const name = normalizeSubjectName(part);
    if (!name) continue;
    if (name.length > SUBJECT_NAME_MAX) {
      return {
        names: [],
        error: `"${name.slice(0, 20)}…" passa de ${SUBJECT_NAME_MAX} caracteres. Separe as disciplinas por vírgula.`,
      };
    }
    const key = name.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  if (names.length > 20) return { names: [], error: "Informe no máximo 20 disciplinas." };
  return { names };
}
