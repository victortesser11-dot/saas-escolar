/**
 * Comparação de respostas curtas. Ignora maiúsculas, acentos, espaços extras e
 * pontuação nas pontas; trata vírgula e ponto decimal como iguais ("0,5" = "0.5").
 * A mesma regra será implementada no banco para a correção (Etapa 5).
 */
export function normalizeShortAnswer(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s.,;:!?"'()]+|[\s.,;:!?"'()]+$/g, "");
}

export function matchesShortAnswer(answer: string, accepted: string[]): boolean {
  const normalized = normalizeShortAnswer(answer);
  if (normalized === "") return false;
  return accepted.some((option) => normalizeShortAnswer(option) === normalized);
}
