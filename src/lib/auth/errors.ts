/**
 * Traduz códigos de erro do Supabase Auth para mensagens ao usuário.
 * Mensagens deliberadamente genéricas onde detalhar revelaria se um e-mail existe.
 * Referência de códigos: https://supabase.com/docs/guides/auth/debugging/error-codes
 */
const MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou senha incorretos.",
  email_not_confirmed:
    "Seu e-mail ainda não foi confirmado. Abra o link que enviamos para concluir o cadastro.",
  weak_password: "Essa senha é fraca. Use pelo menos 8 caracteres, misturando letras e números.",
  same_password: "A nova senha precisa ser diferente da atual.",
  over_email_send_rate_limit:
    "Muitos e-mails enviados em pouco tempo. Aguarde alguns minutos e tente novamente.",
  over_request_rate_limit: "Muitas tentativas em pouco tempo. Aguarde alguns minutos.",
  signup_disabled: "Novos cadastros estão temporariamente desativados.",
  provider_disabled: "Esse método de login ainda não está disponível.",
  validation_failed: "Confira os dados informados e tente novamente.",
  session_expired: "Sua sessão expirou. Entre novamente.",
  otp_expired: "Este link expirou ou já foi usado. Solicite um novo.",
};

export const GENERIC_AUTH_ERROR = "Não foi possível concluir agora. Tente novamente em instantes.";

export function authErrorMessage(code: string | undefined | null): string {
  return (code && MESSAGES[code]) || GENERIC_AUTH_ERROR;
}
