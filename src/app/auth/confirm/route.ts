import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { ROUTES, safeNextPath } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change"];

/**
 * Destino dos links enviados por e-mail (confirmação de cadastro e redefinição de senha).
 * Usa token_hash, que funciona mesmo se o link for aberto em outro aparelho.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const fallback = type === "recovery" ? ROUTES.resetPassword : ROUTES.dashboard;
  const next = safeNextPath(searchParams.get("next"), fallback);

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      redirect(next);
    }
  }

  redirect(`${ROUTES.signIn}?erro=link`);
}
