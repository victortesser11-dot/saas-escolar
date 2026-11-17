import { expect, test } from "@playwright/test";
import {
  answerAllAndSubmit,
  enterExam,
  expectNoHorizontalOverflow,
  studentPage,
  teacherAppliesExam,
} from "./helpers/exam";

/** Acompanhamento, liberação, correção e dashboard de notas (Etapa 7). */

test("professor acompanha, libera retomada, corrige e vê o boletim", async ({ page, browser }) => {
  const exam = await teacherAppliesExam(page, { withEssay: true });

  // Lia faz a prova inteira (com dissertativa).
  const lia = await studentPage(browser);
  await lia.goto(exam.path);
  await enterExam(lia, exam, "Lia", "801");
  await answerAllAndSubmit(lia);
  await expect(lia.getByText(/Nota parcial/)).toBeVisible();

  // Rafael começa e abre a prova em outro aparelho: interrompida.
  const rafaelA = await studentPage(browser);
  await rafaelA.goto(exam.path);
  await enterExam(rafaelA, exam, "Rafael", "802");
  await expect(rafaelA.getByText(/Questão 1 de/)).toBeVisible();
  const rafaelB = await studentPage(browser);
  await rafaelB.goto(exam.path);
  await enterExam(rafaelB, exam, "Rafael", "802");
  await expect(rafaelB.getByText("Sua prova foi interrompida")).toBeVisible();

  // Professor: acompanhamento da turma.
  await page.goto(exam.examUrl);
  await page.getByRole("link", { name: "Acompanhar e notas" }).click();
  await expect(page.getByText(/1 aluno com prova interrompida/)).toBeVisible();
  const kpi = (label: string) =>
    page
      .locator("dl div")
      .filter({ hasText: label })
      .filter({ visible: true })
      .locator("dd")
      .first();
  await expect(kpi("Participação")).toHaveText("1/2");
  await expect(kpi("Para corrigir")).toHaveText("1");
  await expect(page.getByText("Acerto por questão")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // Tabela de alunos (o gráfico também tem uma tabela, só para leitores de tela).
  const rows = page
    .locator("table")
    .filter({ hasText: "Situação" })
    .filter({ visible: true })
    .locator("tbody tr");
  // Quem pede ação vem primeiro: interrompida, depois aguardando correção.
  await expect(rows.first()).toContainText("Rafael Costa");
  await expect(rows.first()).toContainText("Interrompida");
  await expect(rows.nth(1)).toContainText("Aguarda correção");

  // Liberar retomada para Rafael, com minutos extras.
  await rows.first().getByRole("button", { name: "Liberar retomada" }).click();
  await rows.first().getByRole("textbox").fill("5");
  await rows.first().getByRole("button", { name: "Liberar retomada" }).click();
  await expect(rows.first()).toContainText("Retomada liberada");

  // Rafael volta e termina.
  await rafaelB.goto(exam.path);
  await enterExam(rafaelB, exam, "Rafael", "802");
  await expect(rafaelB.getByText(/Questão 1 de/)).toBeVisible();
  await answerAllAndSubmit(rafaelB);

  // Professor corrige as dissertativas pelo atalho "Corrigir agora".
  await page.reload();
  await expect(kpi("Para corrigir")).toHaveText("2");
  await page.getByRole("link", { name: "Corrigir agora" }).click();
  await expect(page.getByText("1 questão para corrigir")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const toGrade = () =>
    page.locator("ol > li").filter({ hasText: "para corrigir" }).filter({ visible: true });
  await toGrade().getByRole("button", { name: "Inteira" }).click();
  await expect(page.getByText("Correção salva.").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Correção concluída").filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/100%/).first()).toBeVisible();

  await page.getByRole("link", { name: /Próximo a corrigir/ }).click();
  await toGrade().getByRole("button", { name: "Metade" }).click();
  await expect(page.getByText("Correção concluída").filter({ visible: true })).toBeVisible();

  // Acompanhamento sem pendências.
  await page.getByRole("link", { name: "Voltar à turma" }).click();
  await expect(kpi("Participação")).toHaveText("2/2");
  await expect(kpi("Para corrigir")).toHaveText("0");

  // Boletim da turma e visão geral.
  await page.getByRole("link", { name: "Notas da turma" }).click();
  await expect(page.getByRole("heading", { name: "Boletim" })).toBeVisible();
  const gradebook = page.locator("tbody tr").filter({ visible: true });
  await expect(gradebook).toHaveCount(2);
  await expect(gradebook.filter({ hasText: "Lia Duarte" })).toContainText("100%");
  await expect(gradebook.filter({ hasText: "Rafael Costa" })).toContainText("75%");
  await expectNoHorizontalOverflow(page);

  await page
    .getByRole("navigation", { name: "Seções do painel" })
    .getByRole("link", { name: "Notas" })
    .click();
  await expect(page.getByText("Média geral")).toBeVisible();
  await expect(page.getByRole("link", { name: /8º B/ })).toContainText("87,5%");
  await expectNoHorizontalOverflow(page);
});

test("painel não rola para os lados no celular", async ({ page }) => {
  await teacherAppliesExam(page);
  for (const path of ["/painel", "/painel/provas", "/painel/notas", "/painel/questoes"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalOverflow(page);
  }
});
