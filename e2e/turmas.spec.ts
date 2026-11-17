import { expect, test, type Page } from "@playwright/test";
import { field, signOut, signUpAndConfirm } from "./helpers/auth";
import { uniqueEmail } from "./helpers/mailpit";

/**
 * Turmas e alunos (Etapa 2) contra o Supabase local.
 * Cada teste cria um professor novo, portanto os dados não se misturam.
 */

async function createClass(page: Page, name: string, year = "2026") {
  await page.goto("/painel/turmas/nova");
  await field(page, "Nome da turma").fill(name);
  await field(page, "Ano letivo").fill(year);
  await page.getByRole("button", { name: "Criar turma" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function addStudent(page: Page, fullName: string, code: string) {
  await field(page, "Nome completo").fill(fullName);
  await field(page, "Matrícula").fill(code);
  await page.getByRole("button", { name: "Adicionar" }).click();
}

const studentRows = (page: Page) => page.locator("table tbody tr").filter({ visible: true });

/**
 * Envia o arquivo e espera a tela reagir. Repete se o JavaScript da página
 * ainda não tiver carregado quando o arquivo foi selecionado.
 */
async function uploadFile(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
  expectedText: string | RegExp,
) {
  await expect(async () => {
    // O input fica dentro do rótulo visível (o próprio input é visualmente oculto).
    await page.locator('label:visible input[type="file"]').setInputFiles(file);
    await expect(page.getByText(expectedText).filter({ visible: true }).first()).toBeVisible({
      timeout: 1_500,
    });
  }).toPass({ timeout: 15_000 });
}

test("professor cria turma, adiciona e remove alunos", async ({ page }) => {
  await signUpAndConfirm(page, "Joana Pereira", uniqueEmail());
  await expect(page.getByText("Nenhuma turma ainda")).toBeVisible();

  await createClass(page, "7º ano B");
  await expect(page.getByText("Ano 2026 · 0 alunos")).toBeVisible();
  await expect(page.getByText("Nenhum aluno nesta turma")).toBeVisible();

  await addStudent(page, "Bruno Lima", "2026 b02");
  await expect(page.getByText("Bruno Lima foi adicionado(a) à turma.")).toBeVisible();
  await addStudent(page, "Ana Souza", "2026a01");
  await expect(studentRows(page)).toHaveCount(2);
  // Ordem alfabética e matrícula normalizada.
  await expect(studentRows(page).first()).toContainText("Ana Souza");
  await expect(studentRows(page).last()).toContainText("2026B02");

  // Matrícula repetida na mesma turma.
  await addStudent(page, "Outro Nome", "2026A01");
  await expect(page.getByText("A matrícula 2026A01 já está nesta turma.")).toBeVisible();
  await expect(studentRows(page)).toHaveCount(2);

  // Remoção com confirmação.
  const bruno = studentRows(page).filter({ hasText: "Bruno Lima" });
  await bruno.getByRole("button", { name: "Remover" }).click();
  await bruno.getByRole("button", { name: "Remover da turma" }).click();
  await expect(studentRows(page)).toHaveCount(1);

  // A turma aparece no painel com a contagem certa.
  await page.goto("/painel");
  const card = page.getByRole("link", { name: /7º ano B/ });
  await expect(card).toContainText("1 aluno");
});

test("importação de planilha CSV do Excel em português", async ({ page }) => {
  await signUpAndConfirm(page, "Carla Dias", uniqueEmail());
  await createClass(page, "8º ano A");

  await page.getByRole("link", { name: "Importar planilha" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Importar planilha" })).toBeVisible();

  // Excel em português: ponto e vírgula e Windows-1252 ("Matrícula", "João").
  const header = Buffer.from("Nome;Matr\xedcula\r\n", "latin1");
  const body = Buffer.from(
    "Jo\xe3o Alves;801\r\nMaria Clara;802\r\nX;803\r\nPedro Rocha;801\r\n",
    "latin1",
  );
  const csv = { name: "alunos.csv", mimeType: "text/csv", buffer: Buffer.concat([header, body]) };
  await uploadFile(page, csv, "2 alunos prontos para importar");
  await expect(page.getByText("2 linhas com problema")).toBeVisible();
  await expect(page.getByText("Informe o nome completo do aluno.")).toBeVisible();
  await expect(page.getByText("Matrícula 801 repetida (já aparece na linha 2).")).toBeVisible();
  await expect(page.getByRole("cell", { name: "João Alves" })).toBeVisible();

  await page.getByRole("button", { name: "Importar 2 alunos" }).click();
  await expect(page.getByText("2 alunos adicionados à turma.")).toBeVisible();

  await page.getByRole("link", { name: "Ver turma" }).click();
  await expect(studentRows(page)).toHaveCount(2);

  // Reimportar o mesmo arquivo não duplica ninguém.
  await page.goto(page.url() + "/importar");
  await uploadFile(page, csv, "2 alunos prontos para importar");
  await page.getByRole("button", { name: "Importar 2 alunos" }).click();
  await expect(page.getByText(/2 já estavam cadastrados.*2 já estavam na turma/)).toBeVisible();
});

test("arquivo do Excel (.xlsx) recebe orientação para salvar como CSV", async ({ page }) => {
  await signUpAndConfirm(page, "Davi Melo", uniqueEmail());
  await createClass(page, "9º ano C");
  await page.goto(page.url() + "/importar");
  await uploadFile(
    page,
    {
      name: "alunos.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("PK"),
    },
    /Salve-o como CSV/,
  );
});

test("editar, arquivar, reativar e excluir turma; editar aluno", async ({ page }) => {
  await signUpAndConfirm(page, "Eva Nunes", uniqueEmail());
  await createClass(page, "6º ano");
  await addStudent(page, "Fábio Reis", "601");
  await expect(studentRows(page)).toHaveCount(1);

  // Editar aluno: matrícula nova é normalizada.
  await page.getByRole("link", { name: "Fábio Reis" }).click();
  await expect(page.getByText("Matrícula 601")).toBeVisible();
  await field(page, "Matrícula").fill("601-b");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Dados do aluno atualizados.")).toBeVisible();
  await expect(page.getByText("Matrícula 601-B")).toBeVisible();

  // Editar turma.
  await page.getByRole("link", { name: "6º ano" }).first().click();
  await page.getByRole("link", { name: "Editar turma" }).click();
  await field(page, "Nome da turma").fill("6º ano A");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "6º ano A" })).toBeVisible();

  // Arquivar: sai da lista principal.
  await page.getByRole("link", { name: "Editar turma" }).click();
  await page.getByRole("button", { name: "Arquivar turma" }).click();
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByText("Nenhuma turma ainda")).toBeVisible();

  // Reativar pela lista de arquivadas.
  await page.getByRole("link", { name: "1 turma arquivada" }).click();
  await page.getByRole("link", { name: /6º ano A/ }).click();
  await expect(page.getByText("Turma arquivada.")).toBeVisible();
  await page.getByRole("button", { name: "Reativar turma" }).click();
  await expect(page.getByRole("heading", { name: "Adicionar aluno" })).toBeVisible();

  // Excluir turma: o aluno continua existindo.
  await page.getByRole("link", { name: "Editar turma" }).click();
  await page.getByRole("button", { name: "Excluir turma" }).click();
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByText("Nenhuma turma ainda")).toBeVisible();
});

test("um professor não acessa a turma de outro", async ({ page }) => {
  await signUpAndConfirm(page, "Gabi Torres", uniqueEmail());
  await createClass(page, "Turma da Gabi");
  const classUrl = page.url();
  await signOut(page);

  await signUpAndConfirm(page, "Hugo Prado", uniqueEmail());
  await page.goto(classUrl);
  await expect(page.getByText("Página não encontrada")).toBeVisible();
  await expect(page.getByText("Turma da Gabi")).toHaveCount(0);
});
