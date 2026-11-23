import { expect, test, type Page } from "@playwright/test";
import { addStudent, field, signUpAndConfirm } from "./helpers/auth";
import { uniqueEmail } from "./helpers/mailpit";

/** Provas (Etapa 4): montar, publicar e aplicar em turma. */

async function createClassWithStudents(page: Page, name: string) {
  await page.goto("/painel/turmas/nova");
  await field(page, "Nome da turma").fill(name);
  await page.getByRole("button", { name: "Criar turma" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  for (const [student, code] of [
    ["Ana Souza", "101"],
    ["Bruno Lima", "102"],
  ]) {
    await addStudent(page, student, code);
    await expect(page.getByText(`${student} foi adicionado(a) à turma.`)).toBeVisible();
  }
}

async function saveAndNext(page: Page) {
  const before = page.url();
  await page.getByRole("button", { name: "Salvar e criar outra" }).click();
  await expect(page).not.toHaveURL(before);
  await expect(page.getByText("Questão adicionada à prova. Escreva a próxima.")).toBeVisible();
  await expect(field(page, "Enunciado")).toHaveValue("");
}

const examQuestions = (page: Page) => page.locator("ol li").filter({ visible: true });
const summary = (page: Page, label: string) =>
  page.locator("dl div").filter({ hasText: label }).filter({ visible: true }).locator("dd");

test("monta, publica e aplica uma prova em uma turma", async ({ page }) => {
  await signUpAndConfirm(page, "Nina Prado", uniqueEmail());
  await createClassWithStudents(page, "7º A");

  // Uma questão já existente no banco, para trazer depois.
  await page.goto("/painel/questoes/nova");
  await page.getByRole("radio", { name: /^Verdadeiro ou falso/ }).click();
  await field(page, "Enunciado").fill("1/2 é igual a 2/4.");
  await page.getByRole("radio", { name: "Verdadeiro", exact: true }).click();
  await page.getByRole("button", { name: "Salvar questão" }).click();
  await expect(page.getByText("1 questão", { exact: true })).toBeVisible();

  // Nova prova.
  await page.getByRole("link", { name: "Provas" }).click();
  await expect(page.getByText("Nenhuma prova ainda")).toBeVisible();
  await page.getByRole("link", { name: "Nova prova" }).click();
  await field(page, "Nome da prova").fill("Avaliação de frações");
  await page.getByLabel(/Instruções para os alunos/).fill("Leia com atenção.");
  await page.getByRole("button", { name: "Criar e adicionar questões" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Avaliação de frações" })).toBeVisible();
  await expect(page.getByText("Nenhuma questão ainda")).toBeVisible();

  // Escreve questões direto na prova.
  await page.getByRole("link", { name: "Escrever questão" }).first().click();
  await field(page, "Enunciado").fill("Quanto é 3/4 de 1/2?");
  await field(page, "Alternativa A").fill("3/8");
  await field(page, "Alternativa B").fill("1/2");
  await page.getByRole("button", { name: "Remover alternativa D" }).click();
  await page.getByRole("button", { name: "Remover alternativa C" }).click();
  await page.getByRole("radio", { name: "Marcar alternativa A como correta" }).click();
  await saveAndNext(page);

  await page.getByRole("radio", { name: /^Dissertativa/ }).click();
  await field(page, "Enunciado").fill("Explique o que são frações equivalentes.");
  await page.getByRole("button", { name: "Salvar e voltar à prova" }).click();
  await expect(examQuestions(page)).toHaveCount(2);

  // Traz a questão do banco (as já incluídas aparecem desabilitadas).
  await page.getByRole("link", { name: "Trazer do banco" }).click();
  await expect(page.getByText("Já está na prova")).toHaveCount(2);
  await page.getByRole("checkbox", { name: /1\/2 é igual a 2\/4/ }).check();
  await page.getByRole("button", { name: "Adicionar selecionadas" }).click();
  await expect(examQuestions(page)).toHaveCount(3);
  await expect(examQuestions(page).last()).toContainText("1/2 é igual a 2/4.");

  // Valores e total.
  await expect(summary(page, "Nota máxima")).toHaveText("3 pontos");
  const first = page.getByRole("textbox", { name: "Valor da questão 1" });
  await first.fill("2");
  await first.press("Enter");
  await expect(summary(page, "Nota máxima")).toHaveText("4 pontos");

  // Reordenar: a última sobe.
  await page.getByRole("button", { name: "Mover questão 3 para cima" }).click();
  await expect(examQuestions(page).nth(1)).toContainText("1/2 é igual a 2/4.");

  // Regras: sortear parte das questões com valores diferentes é bloqueado.
  await page.getByRole("textbox", { name: "Quantas questões cada aluno recebe" }).fill("2");
  await page.getByRole("textbox", { name: "Tempo máximo em minutos" }).fill("40");
  await page.getByRole("button", { name: "Salvar regras" }).click();
  await expect(page.getByText("Regras salvas.")).toBeVisible();
  await expect(page.getByText(/todas precisam ter o mesmo valor/).first()).toBeVisible();
  await expect(summary(page, "Tempo")).toHaveText("40 minutos");

  await page.getByRole("radio", { name: /Todas as questões da prova/ }).check();
  await page.getByRole("button", { name: "Salvar regras" }).click();
  await expect(page.getByText("Antes de publicar:")).toHaveCount(0);

  // Revisar e publicar.
  await page.getByRole("link", { name: "Revisar e publicar" }).click();
  await expect(page.getByText("Nota máxima de cada aluno: 4 pontos.")).toBeVisible();
  await expect(page.getByText(/questão dissertativa precisa da sua correção/)).toBeVisible();
  await page.getByRole("button", { name: "Publicar prova" }).click();
  await expect(page.getByText(/Prova publicada\. Agora aplique/)).toBeVisible();
  // Publicada: sem edição de valores nem remoção.
  await expect(page.getByRole("textbox", { name: "Valor da questão 1" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(0);

  // Aplicar na turma com código de acesso.
  await page.getByRole("link", { name: "Aplicar em turma" }).first().click();
  await page
    .getByRole("combobox", { name: "Turma", exact: true })
    .selectOption({ label: "7º A — 2 alunos" });
  await page.getByRole("checkbox", { name: /Exigir código de acesso/ }).check();
  await page.getByRole("button", { name: "Aplicar e gerar link" }).click();
  await expect(page.getByText(/Prova aplicada\. Copie o link/)).toBeVisible();

  const assignment = page
    .locator("li")
    .filter({ hasText: "Código de acesso" })
    .filter({ visible: true });
  await expect(assignment).toContainText("7º A");
  await expect(assignment).toContainText("Aberta");
  await expect(assignment).toContainText(/\/p\/[2-9A-Z]{8}/);
  await expect(assignment.getByText(/^\d{4}$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Voltar a rascunho" })).toHaveCount(0);

  // A turma mostra a prova e não pode mais ser excluída.
  await assignment.getByRole("link", { name: "7º A" }).click();
  await expect(page.getByText("Provas desta turma")).toBeVisible();
  await page.getByRole("link", { name: "Editar turma" }).click();
  await page.getByRole("button", { name: "Excluir turma" }).click();
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(page.getByText(/tem provas aplicadas e não pode ser excluída/)).toBeVisible();

  // Questão usada na prova não pode ser excluída do banco.
  await page.goto("/painel/questoes");
  await page.getByRole("link", { name: /1\/2 é igual a 2\/4/ }).click();
  await expect(page.getByText(/está em uma prova publicada/)).toBeVisible();
  await page.getByRole("button", { name: "Excluir questão" }).click();
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(page.getByText(/está em uma ou mais provas e não pode ser excluída/)).toBeVisible();
});

test("prova publicada sem turma volta a rascunho; prova em rascunho pode ser excluída", async ({
  page,
}) => {
  await signUpAndConfirm(page, "Otto Reis", uniqueEmail());
  await page.goto("/painel/provas/nova");
  await field(page, "Nome da prova").fill("Prova rápida");
  await page.getByRole("button", { name: "Criar e adicionar questões" }).click();

  await page.getByRole("link", { name: "Escrever questão" }).first().click();
  await page.getByRole("radio", { name: /^Dissertativa/ }).click();
  await field(page, "Enunciado").fill("Descreva o ciclo da água.");
  await page.getByRole("button", { name: "Salvar e voltar à prova" }).click();

  await page.getByRole("link", { name: "Revisar e publicar" }).click();
  await page.getByRole("button", { name: "Publicar prova" }).click();
  await expect(page.getByText(/Prova publicada. Agora aplique/)).toBeVisible();

  await page.getByRole("button", { name: "Voltar a rascunho" }).click();
  await page.getByRole("button", { name: "Voltar a rascunho" }).click();
  await expect(page.getByRole("link", { name: "Revisar e publicar" })).toBeVisible();

  await page.getByRole("button", { name: "Excluir prova" }).click();
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(page.getByText("Nenhuma prova ainda")).toBeVisible();
});
