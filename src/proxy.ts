import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Executa em todas as rotas, exceto:
     * - arquivos estáticos e de imagem do Next.js
     * - favicon e imagens
     * - /p/... (página pública da prova): o aluno não tem sessão de usuário
     */
    "/((?!_next/static|_next/image|favicon.ico|p/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
