/** Rotas de autenticação e regras de acesso, centralizadas para evitar divergências. */

export const ROUTES = {
  home: "/",
  signIn: "/entrar",
  signUp: "/cadastro",
  forgotPassword: "/recuperar-senha",
  resetPassword: "/redefinir-senha",
  dashboard: "/painel",
  authCallback: "/auth/callback",
  authConfirm: "/auth/confirm",
} as const;

/** Exigem usuário autenticado. */
const PROTECTED_PREFIXES = [ROUTES.dashboard, ROUTES.resetPassword];

/** Só fazem sentido para quem NÃO está autenticado. */
const GUEST_ONLY_PREFIXES = [ROUTES.signIn, ROUTES.signUp, ROUTES.forgotPassword];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Decide se uma navegação precisa ser redirecionada, considerando apenas
 * se há usuário autenticado. Retorna o destino ou null.
 * Esta é uma verificação otimista (no proxy); a autorização real acontece
 * na camada de dados (getCurrentUser) e na RLS do banco.
 */
export function getAuthRedirect(pathname: string, isAuthenticated: boolean): string | null {
  if (!isAuthenticated && PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p))) {
    const next = pathname === ROUTES.dashboard ? "" : `?next=${encodeURIComponent(pathname)}`;
    return `${ROUTES.signIn}${next}`;
  }

  if (isAuthenticated && GUEST_ONLY_PREFIXES.some((p) => matchesPrefix(pathname, p))) {
    return ROUTES.dashboard;
  }

  return null;
}

/**
 * Sanitiza o parâmetro `next` usado após login/confirmação, aceitando apenas
 * caminhos internos. Impede redirecionamento aberto (ex.: //site-malicioso.com).
 */
export function safeNextPath(next: unknown, fallback: string = ROUTES.dashboard): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
