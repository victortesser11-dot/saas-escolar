import { expect } from "@playwright/test";

/**
 * Lê e-mails capturados pelo Mailpit do Supabase local (nenhum e-mail sai do computador).
 * Porta padrão definida em supabase/config.toml ([inbucket] / local_smtp).
 */
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MailpitSearch = { messages: { ID: string; Subject: string }[] };
type MailpitMessage = { HTML: string; Text: string };

/** Aguarda o e-mail mais recente para o destinatário e devolve o link de /auth/confirm. */
export async function getAuthLinkFromEmail(to: string, subject: string): Promise<string> {
  let link: string | undefined;

  await expect
    .poll(
      async () => {
        const query = encodeURIComponent(`to:"${to}" subject:"${subject}"`);
        const search = (await (
          await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`)
        ).json()) as MailpitSearch;
        const latest = search.messages[0];
        if (!latest) return undefined;

        const message = (await (
          await fetch(`${MAILPIT_URL}/api/v1/message/${latest.ID}`)
        ).json()) as MailpitMessage;
        const match = message.HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/);
        link = match?.[1]?.replaceAll("&amp;", "&");
        return link;
      },
      { message: `e-mail "${subject}" para ${to}`, timeout: 15_000 },
    )
    .toBeTruthy();

  return link!;
}

export function uniqueEmail(prefix = "prof") {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@teste.local`;
}
