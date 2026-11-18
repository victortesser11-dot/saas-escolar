import { expect, type Page } from "@playwright/test";
import { getAuthLinkFromEmail } from "./mailpit";

export const PASSWORD = "senha-segura-123";

/** Cadastra um professor e confirma o e-mail pelo link recebido no Mailpit. */
export async function signUpAndConfirm(page: Page, fullName: string, email: string) {
  await page.goto("/cadastro");
  await field(page, "Nome completo").fill(fullName);
  await field(page, "E-mail").fill(email);
  await field(page, "Senha").fill(PASSWORD);
  await page
    .getByRole("checkbox", { name: /Li e aceito/ })
    .filter({ visible: true })
    .check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Verifique seu e-mail" })).toBeVisible();

  const link = await getAuthLinkFromEmail(email, "Confirme seu cadastro");
  await page.goto(link);
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/entrar");
  await field(page, "E-mail").fill(email);
  await field(page, "Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar$/);
}

/**
 * Campo pelo rótulo, ignorando páginas anteriores que o Next 16 mantém ocultas no DOM
 * (navegação "voltar" instantânea).
 */
export function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}
