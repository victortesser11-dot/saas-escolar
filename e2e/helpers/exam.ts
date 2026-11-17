import { expect, type Browser, type Page } from "@playwright/test";
import { field, signUpAndConfirm } from "./auth";
import { uniqueEmail } from "./mailpit";

/** Passos compartilhados: professor monta e aplica uma prova; aluno entra pelo link. */

export type Applied = { path: string; accessCode: string; examUrl: string };

export const STUDENTS = [
  ["Lia Duarte", "801"],
  ["Rafael Costa", "802"],
] as const;

export async function teacherAppliesExam(
  page: Page,
  { withEssay = false }: { withEssay?: boolean } = {},
): Promise<Applied> {
  await signUpAndConfirm(page, "Vera Lins", uniqueEmail());

  await page.goto("/painel/turmas/nova");
  await field(page, "Nome da turma").fill("8º B");
  await page.getByRole("button", { name: "Criar turma" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "8º B" })).toBeVisible();
  for (const [name, code] of STUDENTS) {
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
  let before = page.url();
  await page.getByRole("button", { name: "Salvar e criar outra" }).click();
  await expect(page).not.toHaveURL(before);

  await page.getByRole("radio", { name: /^Resposta curta/ }).click();
  await field(page, "Enunciado").fill("Capital do Brasil?");
  await field(page, "Resposta aceita 1").fill("Brasília");
  if (withEssay) {
    before = page.url();
    await page.getByRole("button", { name: "Salvar e criar outra" }).click();
    await expect(page).not.toHaveURL(before);
    await page.getByRole("radio", { name: /^Dissertativa/ }).click();
    await field(page, "Enunciado").fill("Explique o ciclo da água.");
    await field(page, "Valor padrão").fill("2");
  }
  await page.getByRole("button", { name: "Salvar e voltar à prova" }).click();
  await expect(page.locator("ol li").filter({ visible: true })).toHaveCount(withEssay ? 3 : 2);
  const examUrl = page.url();

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
  return { path, accessCode, examUrl };
}

export async function studentPage(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
  });
  return context.newPage();
}

export async function enterExam(
  page: Page,
  exam: Applied,
  name: string,
  registration: string,
  code?: string,
) {
  await page.getByLabel("Seu nome").fill(name);
  await page.getByLabel("Matrícula").fill(registration);
  await page.getByLabel("Código de acesso").fill(code ?? exam.accessCode);
  await page.getByRole("button", { name: "Começar prova" }).click();
}

/** Responde corretamente a questão que estiver na tela (a ordem é sorteada). */
export async function answerCurrentCorrectly(page: Page) {
  const stem = (await page.locator("article h1").textContent()) ?? "";
  if (stem.includes("2 + 2")) {
    await page.getByRole("radio", { name: /4/ }).click();
  } else if (stem.includes("Capital")) {
    await page.getByRole("textbox", { name: "Sua resposta" }).fill("brasilia");
  } else {
    await page
      .getByRole("textbox", { name: "Sua resposta" })
      .fill("Evaporação, condensação e precipitação.");
  }
}

/** Responde todas as questões e envia a prova. */
export async function answerAllAndSubmit(page: Page) {
  const total = Number(
    ((await page.getByText(/Questão \d+ de \d+/).textContent()) ?? "").match(/de (\d+)/)?.[1] ?? 0,
  );
  for (let i = 0; i < total; i++) {
    await answerCurrentCorrectly(page);
    await expect(page.getByText("Respostas salvas")).toBeVisible();
    if (i < total - 1) await page.getByRole("button", { name: "Próxima" }).click();
  }
  await page.getByRole("button", { name: "Revisar e enviar" }).click();
  await page.getByRole("button", { name: "Enviar prova" }).click();
  await page.getByRole("button", { name: "Sim, enviar" }).click();
  await expect(page.getByRole("heading", { name: "Prova enviada" })).toBeVisible();
}

/** A página não pode rolar para os lados (no celular, o navegador encolheria tudo). */
export async function expectNoHorizontalOverflow(page: Page) {
  const viewport = page.viewportSize()!.width;
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(
    width,
    `largura da página (${width}px) maior que a tela (${viewport}px)`,
  ).toBeLessThanOrEqual(viewport);
}
