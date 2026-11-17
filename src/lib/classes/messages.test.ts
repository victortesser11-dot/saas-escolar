import { describe, expect, it } from "vitest";
import { describeImport, pluralize, toImportSummary } from "./messages";

describe("toImportSummary", () => {
  it("converte o retorno do banco", () => {
    expect(toImportSummary({ created: 3, existing: 1, linked: 4, already_in_class: 0 })).toEqual({
      created: 3,
      existing: 1,
      linked: 4,
      alreadyInClass: 0,
    });
  });

  it("tolera retorno vazio", () => {
    expect(toImportSummary(null)).toEqual({
      created: 0,
      existing: 0,
      linked: 0,
      alreadyInClass: 0,
    });
  });
});

describe("pluralize", () => {
  it("usa singular e plural", () => {
    expect(pluralize(1, "aluno", "alunos")).toBe("1 aluno");
    expect(pluralize(0, "aluno", "alunos")).toBe("0 alunos");
    expect(pluralize(1200, "aluno", "alunos")).toBe("1.200 alunos");
  });
});

describe("describeImport", () => {
  it("descreve uma importação simples", () => {
    expect(describeImport({ created: 30, existing: 0, linked: 30, alreadyInClass: 0 })).toBe(
      "30 alunos adicionados à turma.",
    );
  });

  it("explica alunos já existentes e já vinculados", () => {
    expect(describeImport({ created: 1, existing: 2, linked: 2, alreadyInClass: 1 })).toBe(
      "2 alunos adicionados à turma; 2 já estavam cadastrados no seu espaço (nome mantido); 1 já estava na turma.",
    );
  });

  it("informa quando nada mudou", () => {
    expect(describeImport({ created: 0, existing: 0, linked: 0, alreadyInClass: 0 })).toBe(
      "Nenhum aluno foi importado.",
    );
  });
});
