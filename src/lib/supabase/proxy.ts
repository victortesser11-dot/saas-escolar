import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthRedirect } from "@/lib/auth/routes";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

/**
 * Renova a sessão do Supabase a cada requisição e aplica redirecionamentos
 * otimistas de acesso. Baseado no guia oficial do Supabase para Next.js.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // Cabeçalhos anti-cache: impedem que uma CDN guarde a sessão de um usuário.
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Não inserir código entre createServerClient e getClaims (recomendação do Supabase).
  // getClaims valida a assinatura do JWT; nunca confiar em getSession no servidor.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);

  const destination = getAuthRedirect(request.nextUrl.pathname, isAuthenticated);
  if (destination) {
    const redirectResponse = NextResponse.redirect(new URL(destination, request.url));
    // Preserva cookies renovados, para não encerrar a sessão por engano.
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}
