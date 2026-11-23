import { expect, test } from "@playwright/test";
import {
  answerCurrentCorrectly as answerCurrent,
  enterExam as enter,
  expectNoHorizontalOverflow,
  studentPage,
  teacherAppliesExam,
} from "./helpers/exam";

/**
 * Prova no celular do aluno (Etapas 5 e 6). O professor monta e aplica uma prova
 * pela interface; o aluno usa outro navegador, sem conta.
 */

test("aluno faz a prova no celular: entra, responde, recarrega, envia e vê a nota", async ({
  page,
  browser,
}) => {
  const exam = await teacherAppliesExam(page);
  const student = await studentPage(browser);
  await student.goto(exam.path);

  await expect(student.getByRole("heading", { name: "Mini prova" })).toBeVisible();
  await expect(student.getByText("2 questões")).toBeVisible();
  await expectNoHorizontalOverflow(student);

  // Código errado e nome que não confere.
  await enter(student, exam, "Lia", "801", "0000");
  await expect(
    student.getByText("Código de acesso incorreto. Confira com o professor."),
  ).toBeVisible();
  await enter(student, exam, "Carla", "801");
  await expect(student.getByText(/já está com outro nome na turma/)).toBeVisible();

  // Entrada válida (nome em minúsculas, número com espaço).
  await enter(student, exam, "lia", " 801 ");
  await expect(student.getByText("Questão 1 de 2")).toBeVisible();
  await expect(student.getByRole("timer")).toBeVisible();
  await expectNoHorizontalOverflow(student);

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
  await expectNoHorizontalOverflow(student);

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
