import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { ROUTES, safeNextPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

/** Retorno do login social (Google): troca o código por uma sessão. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(next);
    }
  }

  redirect(`${ROUTES.signIn}?erro=google`);
}
