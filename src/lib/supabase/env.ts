/**
 * Variáveis públicas do Supabase. São lidas no momento do uso (não na importação)
 * para que o build não dependa delas.
 *
 * As referências precisam ser literais (process.env.NEXT_PUBLIC_...) para o
 * Next.js embuti-las no bundle do navegador.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (veja .env.example).",
    );
  }

  return { url, publishableKey };
}
