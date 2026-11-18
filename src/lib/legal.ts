/**
 * Dados dos Termos de uso e da Política de privacidade.
 * `version` vai junto do aceite no cadastro: ao mudar o texto de forma relevante,
 * atualize a versão e a data.
 */
export const LEGAL = {
  version: "2026-11-17",
  updatedAt: "17 de novembro de 2026",
  product: "Avaliações Escolares",
  /** Nome completo ou razão social de quem oferece o serviço. */
  owner: "Victor Tesser Rodrigues Blasco",
  /** CPF ou CNPJ (opcional, mas recomendado). */
  ownerDocument: "CNPJ 69.853.386/0001-80",
  /** E-mail para pedidos sobre dados pessoais (também atua como canal do encarregado). */
  contactEmail: "privacidade@moda-triade.com.br",
} as const;

export const LEGAL_ROUTES = { terms: "/termos", privacy: "/privacidade" } as const;

export function legalIsComplete() {
  return LEGAL.owner.trim() !== "" && LEGAL.contactEmail.trim() !== "";
}

// Trava: não publicar em produção com o responsável ou o contato em branco.
if (process.env.VERCEL_ENV === "production" && !legalIsComplete()) {
  throw new Error(
    "Preencha LEGAL.owner e LEGAL.contactEmail em src/lib/legal.ts antes de publicar.",
  );
}

/** Texto usado nas páginas quando o dado ainda não foi preenchido (só em desenvolvimento). */
export function ownerLabel() {
  const name = LEGAL.owner.trim() || "[responsável a preencher]";
  return LEGAL.ownerDocument.trim() ? `${name} (${LEGAL.ownerDocument.trim()})` : name;
}

export function contactEmail() {
  return LEGAL.contactEmail.trim() || "[e-mail a preencher]";
}
