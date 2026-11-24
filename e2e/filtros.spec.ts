import { expect, test } from "@playwright/test";
import { field, signUpAndConfirm } from "./helpers/auth";
import { uniqueEmail } from "./helpers/mailpit";

/** Filtros das listas do painel: turmas por nome; provas por nome e disciplina. */

test("filtra turmas pelo nome e provas pelo nome e pela disciplina", async ({ page }) => {
  await signUpAndConfirm(page, "Tânia Prado", uniqueEmail());

  for (const name of ["7º ano A", "8º ano B"]) {
    await page.goto("/painel/turmas/nova");
    await field(page, "Nome da turma").fill(name);
    await page.getByRole("button", { name: "Criar turma" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  }

  await page.goto("/painel");
  const search = page.getByRole("searchbox", { name: "Buscar turma pelo nome" });
  await search.fill("8º");
  await expect(page.getByRole("link", { name: /8º ano B/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /7º ano A/ })).toHaveCount(0);
  await expect(page.getByText("1 de 2")).toBeVisible();
  await search.fill("zzz");
  await expect(page.getByText("Nenhuma turma encontrada com esse nome.")).toBeVisible();
  await page.getByRole("button", { name: "Limpar" }).click();
  await expect(page.getByRole("link", { name: /7º ano A/ })).toBeVisible();

  for (const [title, subject] of [
    ["Avaliação de frações", "Matemática"],
    ["Modernismo brasileiro", "Literatura"],
    ["Revisão geral", ""],
  ]) {
    await page.goto("/painel/provas/nova");
    await field(page, "Nome da prova").fill(title);
    if (subject) await field(page, "Disciplina").fill(subject);
    await page.getByRole("button", { name: "Criar e adicionar questões" }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  }

  await page.goto("/painel/provas");
  const examSearch = page.getByRole("searchbox", { name: "Buscar prova pelo nome" });
  // Sem acento também encontra.
  await examSearch.fill("fracoes");
  await expect(page.getByRole("link", { name: /Avaliação de frações/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Modernismo/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Limpar" }).click();

  const subject = page.getByRole("combobox", { name: "Disciplina" });
  await subject.selectOption({ label: "Literatura" });
  await expect(page.getByRole("link", { name: /Modernismo brasileiro/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Avaliação de frações/ })).toHaveCount(0);
  await subject.selectOption({ label: "Sem disciplina" });
  await expect(page.getByRole("link", { name: /Revisão geral/ })).toBeVisible();
  await expect(page.getByText("1 de 3")).toBeVisible();
});
