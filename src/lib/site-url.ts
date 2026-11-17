import "server-only";
import { headers } from "next/headers";

/**
 * URL pública do site, usada nos links de retorno da autenticação.
 * Prioriza NEXT_PUBLIC_SITE_URL; sem ela, deriva da própria requisição.
 * O Supabase só aceita retornos para URLs da lista de permitidas, então
 * um cabeçalho forjado não consegue desviar o usuário para outro site.
 */
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) return origin;

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}
