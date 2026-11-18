import { expect, test } from "@playwright/test";
import { field, PASSWORD, signIn, signOut, signUpAndConfirm } from "./helpers/auth";
import { getAuthLinkFromEmail, uniqueEmail } from "./helpers/mailpit";

/**
 * Fluxos de autenticação do professor contra o Supabase local.
 * Pré-requisito: `npm run db:start` (Docker).
 */

test("visitante é levado ao login ao tentar abrir o painel", async ({ page }) => {
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
});

test("cadastro valida os campos antes de enviar", async ({ page }) => {
  await page.goto("/cadastro");
  await field(page, "Nome completo").fill("Ana");
  await field(page, "E-mail").fill("ana@");
  await field(page, "Senha").fill("123");
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
  await expect(page.getByText("A senha precisa ter pelo menos 8 caracteres.")).toBeVisible();
  await expect(page.getByText(/aceite os Termos de uso/)).toBeVisible();
  // Os valores digitados (exceto a senha) são preservados.
  await expect(field(page, "Nome completo")).toHaveValue("Ana");
});

test("cadastro, confirmação por e-mail, saída e novo login", async ({ page }) => {
  const email = uniqueEmail();

  await signUpAndConfirm(page, "Joana Pereira", email);
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole("heading", { name: "Olá, Joana" })).toBeVisible();

  await signOut(page);

  // Senha errada: mensagem genérica.
  await signIn(page, email, "senha-errada-000");
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();

  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole("heading", { name: "Olá, Joana" })).toBeVisible();

  // Autenticado, as páginas de login levam ao painel.
  await page.goto("/entrar");
  await expect(page).toHaveURL(/\/painel$/);
});

test("recuperação de senha por e-mail", async ({ page }) => {
  const email = uniqueEmail();
  await signUpAndConfirm(page, "Carlos Lima", email);
  await expect(page).toHaveURL(/\/painel$/);
  await signOut(page);

  await page.goto("/recuperar-senha");
  await field(page, "E-mail").fill(email);
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByText(/Se houver uma conta com esse e-mail/)).toBeVisible();

  const link = await getAuthLinkFromEmail(email, "Redefinição de senha");
  await page.goto(link);
  await expect(page).toHaveURL(/\/redefinir-senha$/);

  const newPassword = "nova-senha-456";
  await field(page, "Nova senha").fill(newPassword);
  await field(page, "Confirme a nova senha").fill(newPassword);
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(page).toHaveURL(/\/painel$/);

  await signOut(page);
  await signIn(page, email, newPassword);
  await expect(page).toHaveURL(/\/painel$/);
});

test("recuperação de senha não revela se o e-mail existe", async ({ page }) => {
  await page.goto("/recuperar-senha");
  await field(page, "E-mail").fill(uniqueEmail("inexistente"));
  await page.getByRole("button", { name: "Enviar link" }).click();
  await expect(page.getByText(/Se houver uma conta com esse e-mail/)).toBeVisible();
});

test("link de confirmação inválido mostra aviso no login", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=invalido&type=email");
  await expect(page).toHaveURL(/\/entrar\?erro=link$/);
  await expect(page.getByText(/link é inválido ou expirou/)).toBeVisible();
});

test("termos e privacidade abrem sem login, a partir do cadastro", async ({ page }) => {
  await page.goto("/cadastro");
  await page
    .getByRole("navigation", { name: "Documentos legais" })
    .getByRole("link", { name: "Privacidade" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Política de privacidade" }),
  ).toBeVisible();
  await expect(page.getByText(/Crianças e adolescentes/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Documentos legais" })
    .getByRole("link", { name: "Termos de uso" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Termos de uso" })).toBeVisible();
});
