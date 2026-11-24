const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/**
 * Ordem de chamada: pelo número na turma (1, 2, 10…), depois pelo nome.
 * Alunos sem número vão para o fim, em ordem alfabética.
 */
export function compareRoll(
  a: { code: string | null; name: string },
  b: { code: string | null; name: string },
): number {
  if (a.code === null || b.code === null) {
    if (a.code !== b.code) return a.code === null ? 1 : -1;
    return collator.compare(a.name, b.name);
  }
  return collator.compare(a.code, b.code) || collator.compare(a.name, b.name);
}

/** Número para exibir ("—" quando o aluno não informou). */
export function rollLabel(code: string | null): string {
  return code ?? "—";
}
