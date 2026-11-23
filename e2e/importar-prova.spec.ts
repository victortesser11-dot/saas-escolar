import { expect, test, type Page } from "@playwright/test";
import { QUESTIONS_TEMPLATE_CSV } from "../src/lib/questions/csv";
import { field, signUpAndConfirm } from "./helpers/auth";
import { uniqueEmail } from "./helpers/mailpit";

/** Importação das questões de uma prova por planilha (CSV). */

async function upload(page: Page, content: string | Buffer, expectedText: string | RegExp) {
  const file = { name: "prova.csv", mimeType: "text/csv", buffer: Buffer.from(content) };
  // Repete se o JavaScript da página ainda não tiver carregado quando o arquivo foi escolhido.
  await expect(async () => {
    await page.locator('label:visible input[type="file"]').setInputFiles(file);
    await expect(page.getByText(expectedText).filter({ visible: true }).first()).toBeVisible({
      timeout: 1_500,
    });
  }).toPass({ timeout: 15_000 });
}

test("professor importa a prova inteira pela planilha modelo", async ({ page }) => {
  await signUpAndConfirm(page, "Rita Gomes", uniqueEmail());
  await page.goto("/painel/provas/nova");
  await field(page, "Nome da prova").fill("Prova importada");
  await page.getByRole("button", { name: "Criar e adicionar questões" }).click();

  await page.getByRole("link", { name: "Importar planilha" }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Importar questões da planilha" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Baixar planilha modelo" })).toBeVisible();

  // Planilha com um problema: a linha ruim é apontada e as boas seguem.
  const withError = QUESTIONS_TEMPLATE_CSV + "Múltipla escolha;Sem gabarito;x;y;;;;;1;\r\n";
  await upload(page, withError, "5 questões prontas · 6 pontos");
  await expect(page.getByText("1 linha com problema")).toBeVisible();
  await expect(page.getByText("Linha 7")).toBeVisible();
  await expect(page.getByText(/informe a letra da alternativa certa/)).toBeVisible();
  await expect(page.getByText("Correta: B", { exact: false }).first()).toBeVisible();

  await page.getByRole("button", { name: "Importar 5 questões" }).click();
  await expect(page.getByText(/5 questões importadas para a prova/)).toBeVisible();

  await page.getByRole("link", { name: "Ver a prova" }).click();
  await expect(page.locator("ol li").filter({ visible: true })).toHaveCount(5);
  await expect(page.getByText("Quanto é 3/4 + 1/4?")).toBeVisible();
  await expect(page.getByText("Explique com suas palavras o que é uma fração.")).toBeVisible();
});

test("arquivo sem a coluna de enunciado recebe orientação", async ({ page }) => {
  await signUpAndConfirm(page, "Saulo Dias", uniqueEmail());
  await page.goto("/painel/provas/nova");
  await field(page, "Nome da prova").fill("Outra prova");
  await page.getByRole("button", { name: "Criar e adicionar questões" }).click();
  await page.getByRole("link", { name: "Importar planilha" }).first().click();
  await upload(page, "Nome;Número\nAna;1\n", /coluna "Enunciado"/);
});
