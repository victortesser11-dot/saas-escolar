import { expect, test, type Browser, type Page } from "@playwright/test";
import { field, signUpAndConfirm } from "./helpers/auth";
import { uniqueEmail } from "./helpers/mailpit";

/**
 * Prova no celular do aluno (Etapas 5 e 6). O professor monta e aplica uma prova
 * pela interface; o aluno usa outro navegador, sem conta.
 */

type Applied = { path: string; accessCode: string };

async function teacherAppliesExam(page: Page): Promise<Applied> {
  await signUpAndConfirm(page, "Vera Lins", uniqueEmail());

  await page.goto("/painel/turmas/nova");
  await field(page, "Nome da turma").fill("8º B");
  await page.getByRole("button", { name: "Criar turma" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "8º B" })).toBeVisible();
  for (const [name, code] of [
    ["Lia Duarte", "801"],
    ["Rafael Costa", "802"],
  ]) {
    await field(page, "Nome completo").fill(name);
    await field(page, "Matrícula").fill(code);
    await page.getByRole("button", { name: "Adicionar" }).click();
    await expect(page.getByText(`${name} foi adicionado(a) à turma.`)).toBeVisible();
  }

  await page.goto("/painel/provas/nova");
  await field(page, "Nome da prova").fill("Mini prova");
  await page.getByRole("button", { name: "Criar e adicionar questões" }).click();

  await page.getByRole("link", { name: "Escrever questão" }).first().click();
  await field(page, "Enunciado").fill("Quanto é 2 + 2?");
  await field(page, "Alternativa A").fill("4");
  await field(page, "Alternativa B").fill("5");
  await page.getByRole("button", { name: "Remover alternativa D" }).click();
  await page.getByRole("button", { name: "Remover alternativa C" }).click();
  await page.getByRole("radio", { name: "Marcar alternativa A como correta" }).click();
  const before = page.url();
  await page.getByRole("button", { name: "Salvar e criar outra" }).click();
  await expect(page).not.toHaveURL(before);

  await page.getByRole("radio", { name: /^Resposta curta/ }).click();
  await field(page, "Enunciado").fill("Capital do Brasil?");
  await field(page, "Resposta aceita 1").fill("Brasília");
  await page.getByRole("button", { name: "Salvar e voltar à prova" }).click();
  await expect(page.locator("ol li").filter({ visible: true })).toHaveCount(2);

  await page.getByRole("radio", { name: /A nota e as respostas corretas/ }).check();
  await page.getByRole("button", { name: "Salvar regras" }).click();
  await expect(page.getByText("Regras salvas.")).toBeVisible();

  await page.getByRole("link", { name: "Revisar e publicar" }).click();
  await page.getByRole("button", { name: "Publicar prova" }).click();
  await page.getByRole("link", { name: "Aplicar em turma" }).first().click();
  await page.getByRole("combobox", { name: "Turma", exact: true }).selectOption({ index: 1 });
  await page.getByRole("checkbox", { name: /Exigir código de acesso/ }).check();
  await page.getByRole("button", { name: "Aplicar e gerar link" }).click();
  await expect(page.getByText(/Prova aplicada/)).toBeVisible();

  const card = page.locator("li").filter({ hasText: "Código de acesso" }).filter({ visible: true });
  const path = (await card.getByText(/^\/p\/[2-9A-Z]{8}$/).textContent())!.trim();
  const accessCode = (await card.getByText(/^\d{4}$/).textContent())!.trim();
  return { path, accessCode };
}

async function studentPage(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
  });
  return context.newPage();
}

async function enter(page: Page, exam: Applied, name: string, registration: string, code?: string) {
  await page.getByLabel("Seu nome").fill(name);
  await page.getByLabel("Matrícula").fill(registration);
  await page.getByLabel("Código de acesso").fill(code ?? exam.accessCode);
  await page.getByRole("button", { name: "Começar prova" }).click();
}

/** Responde a questão que estiver na tela (a ordem é sorteada). */
async function answerCurrent(page: Page) {
  const stem = await page.locator("article h1").textContent();
  if (stem?.includes("2 + 2")) {
    await page.getByRole("radio", { name: /4/ }).click();
  } else {
    await page.getByRole("textbox", { name: "Sua resposta" }).fill("brasilia");
  }
}

test("aluno faz a prova no celular: entra, responde, recarrega, envia e vê a nota", async ({
  page,
  browser,
}) => {
  const exam = await teacherAppliesExam(page);
  const student = await studentPage(browser);
  await student.goto(exam.path);

  await expect(student.getByRole("heading", { name: "Mini prova" })).toBeVisible();
  await expect(student.getByText("2 questões")).toBeVisible();

  // Código errado e nome que não confere.
  await enter(student, exam, "Lia", "801", "0000");
  await expect(
    student.getByText("Código de acesso incorreto. Confira com o professor."),
  ).toBeVisible();
  await enter(student, exam, "Carla", "801");
  await expect(student.getByText(/Nome e matrícula não conferem/)).toBeVisible();

  // Entrada válida (nome em minúsculas, matrícula com espaço).
  await enter(student, exam, "lia", " 801 ");
  await expect(student.getByText("Questão 1 de 2")).toBeVisible();
  await expect(student.getByRole("timer")).toBeVisible();

  await answerCurrent(student);
  await expect(student.getByText("Respostas salvas")).toBeVisible();

  // Recarregar a página na mesma aba continua a prova, com a resposta salva.
  await student.reload();
  await expect(student.getByText("Questão 1 de 2")).toBeVisible();
  await expect(
    student.getByRole("button", { name: /Ir para a questão 1, respondida/ }),
  ).toBeVisible();

  await student.getByRole("button", { name: "Próxima" }).click();
  await answerCurrent(student);
  await expect(student.getByText("Respostas salvas")).toBeVisible();

  await student.getByRole("button", { name: "Revisar e enviar" }).click();
  await expect(student.getByText("Você respondeu todas as questões.")).toBeVisible();
  await student.getByRole("button", { name: "Enviar prova" }).click();
  await student.getByRole("button", { name: "Sim, enviar" }).click();

  await expect(student.getByRole("heading", { name: "Prova enviada" })).toBeVisible();
  await expect(student.getByText("Sua nota: 2 de 2 pontos.")).toBeAttached();
  await expect(student.getByText("de 2 pontos", { exact: true })).toBeVisible();
  await expect(student.getByText("Suas respostas")).toBeVisible();

  // Tentativa única.
  await student.goto(exam.path);
  await enter(student, exam, "Lia", "801");
  await expect(student.getByText("Você já enviou esta prova")).toBeVisible();
});

test("abrir a prova em outro aparelho interrompe e exige o professor", async ({
  page,
  browser,
}) => {
  const exam = await teacherAppliesExam(page);

  const phoneA = await studentPage(browser);
  await phoneA.goto(exam.path);
  await enter(phoneA, exam, "Rafael", "802");
  await expect(phoneA.getByText("Questão 1 de 2")).toBeVisible();

  const phoneB = await studentPage(browser);
  await phoneB.goto(exam.path);
  await enter(phoneB, exam, "Rafael", "802");
  await expect(phoneB.getByText("Sua prova foi interrompida")).toBeVisible();

  // O primeiro aparelho também é bloqueado ao recarregar.
  await phoneA.reload();
  await expect(phoneA.getByText("Sua prova foi interrompida")).toBeVisible();
});

test("link inexistente mostra aviso amigável", async ({ browser }) => {
  const student = await studentPage(browser);
  await student.goto("/p/ZZZZZZZZ");
  await expect(student.getByText("Prova não encontrada")).toBeVisible();
});
