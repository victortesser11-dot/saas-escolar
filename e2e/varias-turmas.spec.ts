import { expect, test } from "@playwright/test";
import { addStudent, field, signUpAndConfirm } from "./helpers/auth";
import { enterExam, expectNoHorizontalOverflow, studentPage } from "./helpers/exam";
import { uniqueEmail } from "./helpers/mailpit";

/**
 * Pedidos de 2026-11-25: aplicar uma prova em várias turmas de uma vez, identificação
 * da prova na tela do aluno e validação manual de prova interrompida.
 */

test("aplica em várias turmas, aluno vê a identificação e professor valida a interrompida", async ({
  page,
  browser,
}) => {
  await signUpAndConfirm(page, "Rosa Mendes", uniqueEmail());

  // Três turmas; a 21N com uma aluna na lista.
  for (const name of ["21M", "21N", "21T"]) {
    await page.goto("/painel/turmas/nova");
    await field(page, "Nome da turma").fill(name);
    await page.getByRole("button", { name: "Criar turma" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    if (name === "21N") {
      await addStudent(page, "Sabrina Ramos", "5");
      await expect(page.getByText("Sabrina Ramos foi adicionado(a) à turma.")).toBeVisible();
    }
  }

  // Prova com disciplina e período; duas questões importadas.
  await page.goto("/painel/provas/nova");
  await field(page, "Nome da prova").fill("Recuperação de Literatura");
  await field(page, "Disciplina").fill("Literatura");
  await field(page, "Período").fill("1º trimestre");
  await page.getByRole("button", { name: "Criar e adicionar questões" }).click();
  await page.getByRole("link", { name: "Importar planilha" }).first().click();
  const csv =
    "Tipo;Enunciado;A;B;Correta;Valor\nME;Quem escreveu Dom Casmurro?;Machado;Alencar;A;1\nVF;Bilac foi parnasiano.;;;V;1\n";
  await expect(async () => {
    await page
      .locator('label:visible input[type="file"]')
      .setInputFiles({ name: "p.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(page.getByText("2 questões prontas", { exact: false })).toBeVisible({
      timeout: 1_500,
    });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Importar 2 questões" }).click();
  await page.getByRole("link", { name: "Ver a prova" }).click();
  await page.getByRole("link", { name: "Revisar e publicar" }).click();
  await page.getByRole("button", { name: "Publicar prova" }).click();

  // Aplicar nas três turmas de uma vez.
  await page.getByRole("link", { name: "Aplicar em turma" }).first().click();
  await page.getByRole("button", { name: "Selecionar todas" }).click();
  await page.getByRole("checkbox", { name: /Exigir código de acesso/ }).check();
  await page.getByRole("button", { name: "Aplicar em 3 turmas e gerar links" }).click();
  await expect(page.getByText(/Prova aplicada em 3 turmas/)).toBeVisible();

  // Cada turma com o próprio link e código.
  const table = page.locator("table").filter({ hasText: "Código" }).filter({ visible: true });
  const rows = table.locator("tbody tr");
  await expect(rows).toHaveCount(3);
  const paths = await rows.locator("td:nth-child(2)").allTextContents();
  expect(new Set(paths).size).toBe(3);
  await expect(page.getByRole("button", { name: "Copiar todos" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const row21N = rows.filter({ hasText: "21N" });
  const path21N = (await row21N.locator("td:nth-child(2)").textContent())!.trim();
  const code21N = (await row21N.locator("td:nth-child(3)").textContent())!.trim();

  // Aluna vê a identificação completa da prova.
  const sabrina = await studentPage(browser);
  await sabrina.goto(path21N);
  const identity = sabrina.getByRole("definition");
  await expect(sabrina.getByRole("heading", { name: "Recuperação de Literatura" })).toBeVisible();
  await expect(identity.filter({ hasText: "Literatura" }).first()).toBeVisible();
  await expect(identity.filter({ hasText: "1º trimestre" })).toBeVisible();
  await expect(identity.filter({ hasText: "21N" })).toBeVisible();
  await expect(identity.filter({ hasText: "Rosa Mendes" })).toBeVisible();
  await expectNoHorizontalOverflow(sabrina);

  // Responde a primeira questão e a prova é interrompida (abriu em outro aparelho).
  const exam = { path: path21N, accessCode: code21N, examUrl: "" };
  await enterExam(sabrina, exam, "Sabrina", "5");
  await expect(sabrina.getByText(/Questão 1 de 2/)).toBeVisible();
  await sabrina.getByRole("radio").first().click();
  await expect(sabrina.getByText("Respostas salvas")).toBeVisible();
  const other = await studentPage(browser);
  await other.goto(path21N);
  await enterExam(other, exam, "Sabrina", "5");
  await expect(other.getByText("Sua prova foi interrompida")).toBeVisible();

  // Professor: libera a retomada e, mesmo assim, consegue validar.
  await page.goto("/painel");
  await page.getByRole("link", { name: /21N/ }).click();
  await page.getByRole("link", { name: "Recuperação de Literatura" }).click();
  const student = page
    .locator("table")
    .filter({ hasText: "Situação" })
    .filter({ visible: true })
    .locator("tbody tr")
    .filter({ hasText: "Sabrina Ramos" });
  await expect(student).toContainText("Interrompida");
  await student.getByRole("button", { name: "Liberar retomada" }).click();
  await student.getByRole("button", { name: "Liberar retomada" }).click();
  await expect(student).toContainText("Retomada liberada");

  await student.getByRole("link", { name: /Respostas/ }).click();
  await expect(page.getByText(/salvou 1 de 2 respostas/)).toBeVisible();
  await page.getByRole("button", { name: "Validar prova" }).click();
  await page.getByRole("button", { name: "Sim, validar" }).click();
  await expect(
    page.getByText(/Prova validada manualmente por Rosa Mendes \(1 de 2 respostas salvas\)/),
  ).toBeVisible();
  await expect(page.getByText("Prova interrompida.")).toHaveCount(0);
});
