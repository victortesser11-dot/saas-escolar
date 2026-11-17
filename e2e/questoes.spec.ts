import { expect, test, type Page } from "@playwright/test";
import { field, signOut, signUpAndConfirm } from "./helpers/auth";
import { uniqueEmail } from "./helpers/mailpit";

/** Banco de questões (Etapa 3) contra o Supabase local. */

const typeRadio = (page: Page, label: string) =>
  page.getByRole("radio", { name: new RegExp(`^${label}`) });

const questionItems = (page: Page) =>
  page
    .locator("main ul li")
    .filter({ visible: true })
    .filter({ has: page.locator("a") });

/** "Salvar e criar outra" bem-sucedido: espera a URL mudar e o formulário limpar. */
async function saveAndNew(page: Page) {
  const before = page.url();
  await page.getByRole("button", { name: "Salvar e criar outra" }).click();
  await expect(page).not.toHaveURL(before);
  await expect(page.getByText("Questão salva. Cadastre a próxima.")).toBeVisible();
  await expect(field(page, "Enunciado")).toHaveValue("");
}

async function startNew(page: Page) {
  await page.goto("/painel/questoes/nova");
  await expect(page.getByRole("heading", { level: 1, name: "Nova questão" })).toBeVisible();
}

test("cadastra os cinco tipos de questão e filtra o banco", async ({ page }) => {
  await signUpAndConfirm(page, "Lia Moraes", uniqueEmail());

  await page.getByRole("link", { name: "Questões" }).click();
  await expect(page.getByText("Seu banco de questões está vazio")).toBeVisible();

  // 1) Múltipla escolha: o gabarito é obrigatório.
  await startNew(page);
  await field(page, "Enunciado").fill("Quanto é 3/4 de 1/2?");
  for (const [letter, text] of [
    ["A", "3/8"],
    ["B", "1/2"],
    ["C", "3/2"],
    ["D", "6/8"],
  ]) {
    await field(page, `Alternativa ${letter}`).fill(text);
  }
  await page.getByRole("button", { name: "Salvar e criar outra" }).click();
  await expect(page.getByText("Marque qual é a alternativa correta.")).toBeVisible();

  await page.getByRole("radio", { name: "Marcar alternativa A como correta" }).click();
  await field(page, "Valor padrão").fill("1,5");
  await field(page, "Assuntos").fill("Frações, 7º ano");
  await saveAndNew(page);

  // 2) Verdadeiro ou falso.
  await typeRadio(page, "Verdadeiro ou falso").click();
  await field(page, "Enunciado").fill("Todo número primo é ímpar.");
  await page.getByRole("radio", { name: "Falso", exact: true }).click();
  await field(page, "Assuntos").fill("números primos");
  await saveAndNew(page);

  // 3) Seleção múltipla: várias corretas.
  await typeRadio(page, "Seleção múltipla").click();
  await field(page, "Enunciado").fill("Quais números são primos?");
  for (const [letter, text] of [
    ["A", "2"],
    ["B", "3"],
    ["C", "4"],
    ["D", "9"],
  ]) {
    await field(page, `Alternativa ${letter}`).fill(text);
  }
  await page.getByRole("checkbox", { name: "Marcar alternativa A como correta" }).click();
  await page.getByRole("checkbox", { name: "Marcar alternativa B como correta" }).click();
  await field(page, "Assuntos").fill("números primos");
  await saveAndNew(page);

  // 4) Resposta curta com duas formas aceitas; repetição por acento é detectada.
  await typeRadio(page, "Resposta curta").click();
  await field(page, "Enunciado").fill("Qual é a capital do Brasil?");
  await field(page, "Resposta aceita 1").fill("Brasília");
  await page.getByRole("button", { name: "Adicionar outra resposta aceita" }).click();
  await field(page, "Resposta aceita 2").fill("BRASILIA");
  await page.getByRole("button", { name: "Salvar e criar outra" }).click();
  await expect(page.getByText("Repetida: igual a outra alternativa.")).toBeVisible();
  await field(page, "Resposta aceita 2").fill("Brasília DF");
  await saveAndNew(page);

  // 5) Dissertativa, salva e volta para a lista.
  await typeRadio(page, "Dissertativa").click();
  await field(page, "Enunciado").fill("Explique o que é fotossíntese.");
  await page
    .getByLabel(/Resposta esperada e critérios/)
    .filter({ visible: true })
    .fill("Citar luz, água e gás carbônico.");
  await field(page, "Valor padrão").fill("3");
  await page.getByRole("button", { name: "Salvar questão" }).click();

  await expect(page).toHaveURL(/\/painel\/questoes\?salva=1$/);
  await expect(page.getByText("Questão salva.", { exact: true })).toBeVisible();
  await expect(page.getByText("5 questões")).toBeVisible();
  await expect(questionItems(page)).toHaveCount(5);
  await expect(questionItems(page).first()).toContainText("Dissertativa");
  await expect(questionItems(page).first()).toContainText("Correção manual");
  await expect(questionItems(page).last()).toContainText("1,5 pontos");

  // Filtro por assunto.
  await page.getByRole("link", { name: "números primos", exact: true }).click();
  await expect(page.getByText("2 questões")).toBeVisible();

  // Busca + tipo.
  await page.goto("/painel/questoes");
  await page.getByRole("searchbox", { name: "Buscar no enunciado" }).fill("capital");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByText("1 questão", { exact: true })).toBeVisible();
  await expect(questionItems(page).first()).toContainText("Qual é a capital do Brasil?");

  await page.goto("/painel/questoes?tipo=true_false");
  await expect(page.getByText("1 questão", { exact: true })).toBeVisible();
});

test("edita e exclui uma questão; outro professor não acessa", async ({ page }) => {
  await signUpAndConfirm(page, "Rui Campos", uniqueEmail());
  await startNew(page);
  await field(page, "Enunciado").fill("Quanto é 2 + 2?");
  await field(page, "Alternativa A").fill("4");
  await field(page, "Alternativa B").fill("5");
  await page.getByRole("radio", { name: "Marcar alternativa A como correta" }).click();
  await page.getByRole("button", { name: "Remover alternativa D" }).click();
  await page.getByRole("button", { name: "Remover alternativa C" }).click();
  await page.getByRole("button", { name: "Salvar questão" }).click();
  await expect(page.getByText("1 questão", { exact: true })).toBeVisible();

  // Edição preserva gabarito e alternativas.
  await questionItems(page).first().getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1, name: "Editar questão" })).toBeVisible();
  await expect(field(page, "Alternativa A")).toHaveValue("4");
  await expect(
    page.getByRole("radio", { name: "Marcar alternativa A como correta" }),
  ).toHaveAttribute("aria-checked", "true");
  await field(page, "Enunciado").fill("Quanto é 2 + 3?");
  await field(page, "Alternativa B").fill("5");
  await field(page, "Alternativa A").fill("4");
  await page.getByRole("radio", { name: "Marcar alternativa B como correta" }).click();
  await page.getByRole("button", { name: "Salvar questão" }).click();
  await expect(questionItems(page).first()).toContainText("Quanto é 2 + 3?");
  const questionUrl = await questionItems(page).first().getByRole("link").getAttribute("href");

  // Outro professor não acessa.
  await signOut(page);
  await signUpAndConfirm(page, "Sara Lopes", uniqueEmail());
  await page.goto(questionUrl!);
  await expect(page.getByText("Página não encontrada")).toBeVisible();
  await signOut(page);

  // Dono exclui.
  await signUpAndConfirm(page, "Teo Vaz", uniqueEmail());
  await startNew(page);
  await typeRadio(page, "Dissertativa").click();
  await field(page, "Enunciado").fill("Questão temporária");
  await page.getByRole("button", { name: "Salvar questão" }).click();
  await questionItems(page).first().getByRole("link").click();
  await page.getByRole("button", { name: "Excluir questão" }).click();
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(page.getByText("Seu banco de questões está vazio")).toBeVisible();
});
