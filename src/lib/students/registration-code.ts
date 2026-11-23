/**
 * Mesma regra de private.normalize_registration_code no banco:
 * remove espaços e converte para maiúsculas.
 * Usada no cadastro, na importação e (Etapa 5) na identificação do aluno na prova.
 */
export function normalizeRegistrationCode(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/**
 * Chave de comparação do número na turma (espelha private.roll_key):
 * números só com dígitos ignoram zeros à esquerda ("07" = "7").
 */
export function rollKey(raw: string): string {
  const code = normalizeRegistrationCode(raw);
  return /^[0-9]+$/.test(code) ? code.replace(/^0+(?=.)/, "") : code;
}

/** Formato aceito após normalizar (espelha a constraint do banco). */
export const REGISTRATION_CODE_PATTERN = /^[A-Z0-9./_-]{1,40}$/;

/** Remove espaços extras do nome (mesma regra da importação no banco). */
export function normalizeFullName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}
