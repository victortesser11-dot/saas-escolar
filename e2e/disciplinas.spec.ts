import { expect, test } from "@playwright/test";
import {
  answerAllAndSubmit,
  enterExam,
  expectNoHorizontalOverflow,
  studentPage,
  teacherAppliesExam,
} from "./helpers/exam";

/** Retorno do piloto: disciplinas dentro da turma e alunos que se cadastram pela prova. */

test("aluno fora da lista entra pela prova; turma separa provas e notas por disciplina", async ({
  page,
  browser,
}) => {
  const exam = await teacherAppliesExam(page, {
    withStudents: false,
    subject: "matemática",
    classSubjects: "Matemática, Ciências",
  });

  // Turma sem lista: o aluno digita nome e número e começa a prova.
  const nina = await studentPage(browser);
  await nina.goto(exam.path);
  await enterExam(nina, exam, "Nina Alves", "05");
  await answerAllAndSubmit(nina);

  // Outro aluno com o mesmo número (5 = 05) e outro nome é barrado.
  const other = await studentPage(browser);
  await other.goto(exam.path);
  await enterExam(other, exam, "Otávio", "5");
  await expect(other.getByText(/já está com outro nome na turma/)).toBeVisible();

  // Professor: a aluna aparece na turma, marcada como "entrou pela prova".
  await page.goto("/painel");
  await page.getByRole("link", { name: /8º B/ }).click();
  const subjects = page.getByRole("list", { name: "Disciplinas da turma" });
  await expect(subjects.getByRole("listitem")).toHaveText(["Ciências", "Matemática"]);
  const rows = page.locator("table tbody tr").filter({ visible: true });
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("05");
  await expect(rows.first()).toContainText("Nina Alves");
  await expect(rows.first()).toContainText("entrou pela prova");
  await expectNoHorizontalOverflow(page);

  // A prova aparece no grupo da disciplina, com o boletim filtrado.
  await page.getByRole("link", { name: "Boletim de Matemática" }).click();
  await expect(page.getByRole("link", { name: "Matemática", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page.locator("tbody tr").filter({ visible: true }).filter({ hasText: "Nina Alves" }),
  ).toContainText("100%");
  await page.getByRole("link", { name: "Ciências", exact: true }).click();
  await expect(page.getByText(/Nenhuma prova/)).toBeVisible();

  // Fechar a lista: só entra quem já está nela.
  await page.getByRole("link", { name: "Alunos da turma" }).click();
  await page.getByRole("button", { name: "Fechar a lista" }).click();
  await expect(page.getByText("Lista fechada.")).toBeVisible();
  const late = await studentPage(browser);
  await late.goto(exam.path);
  await enterExam(late, exam, "Paulo Reis", "6");
  await expect(
    late.getByText("Esse número não está na lista da turma.", { exact: false }),
  ).toBeVisible();
});

test("professor inclui e tira disciplinas da turma", async ({ page }) => {
  await teacherAppliesExam(page, { withStudents: false });
  await page.goto("/painel");
  await page.getByRole("link", { name: /8º B/ }).click();

  const subjects = page.getByRole("list", { name: "Disciplinas da turma" });
  await page.getByPlaceholder("Incluir disciplina (ex.: Ciências)").fill("  história ");
  await page.getByRole("button", { name: "Incluir" }).click();
  await expect(subjects.getByRole("listitem")).toHaveText(["História"]);

  await page.getByRole("button", { name: "Tirar História da turma" }).click();
  await expect(subjects).toHaveCount(0);
});
