import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { ROUTES } from "./routes";

type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  workspace: Pick<WorkspaceRow, "id" | "name" | "type" | "plan">;
  role: Database["public"]["Enums"]["workspace_role"];
};

/**
 * Camada de acesso a dados: ponto único para obter o usuário autenticado.
 * Valida o JWT (getClaims) e lê perfil e espaço de trabalho sob RLS.
 * Redireciona para o login se não houver sessão válida.
 * `cache` evita consultas repetidas dentro da mesma requisição.
 *
 * `connection()` adia a execução para o momento da requisição: o cliente Supabase
 * consulta o relógio (validade do token), o que não pode acontecer durante a
 * pré-renderização do Next 16 (Cache Components / Partial Prefetching).
 * Regra: Server Components devem obter dados de usuário por funções desta camada.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims?.sub) {
    redirect(ROUTES.signIn);
  }

  const [profileResult, membershipResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", claims.sub).single(),
    supabase
      .from("workspace_members")
      .select("role, workspaces (id, name, type, plan)")
      .eq("user_id", claims.sub)
      .order("created_at", { ascending: true })
      .limit(1)
      .single(),
  ]);

  const workspace = membershipResult.data?.workspaces;
  if (profileResult.error || membershipResult.error || !workspace) {
    // Sem perfil/espaço o painel não funciona: falha explícita, registrada nos logs.
    throw new Error("Conta sem perfil ou espaço de trabalho associado.");
  }

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: profileResult.data.full_name,
    workspace,
    role: membershipResult.data.role,
  };
});
