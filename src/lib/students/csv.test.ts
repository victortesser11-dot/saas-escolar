import { describe, expect, it } from "vitest";
import { decodeCsvBytes, MAX_IMPORT_ROWS, parseStudentsCsv } from "./csv";

describe("parseStudentsCsv", () => {
  it("lê CSV do Excel em português (ponto e vírgula, com cabeçalho acentuado)", () => {
    const csv = "Nome;Matrícula\nAna Souza;2024A013\nBruno  Lima ; 2024 a014\n";
    const result = parseStudentsCsv(csv);
    expect(result.fatal).toBeUndefined();
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { fullName: "Ana Souza", registrationCode: "2024A013", line: 2 },
      { fullName: "Bruno Lima", registrationCode: "2024A014", line: 3 },
    ]);
  });

  it("lê CSV com vírgula e colunas em outra ordem", () => {
    const csv = "RA,Turma,Nome do aluno\n555,7B,Carla Dias\n";
    const result = parseStudentsCsv(csv);
    expect(result.rows).toEqual([{ fullName: "Carla Dias", registrationCode: "555", line: 2 }]);
  });

  it("aceita arquivo sem cabeçalho (nome, matrícula)", () => {
    const result = parseStudentsCsv("Davi Rocha;101\nEva Melo;102");
    expect(result.rows.map((r) => r.registrationCode)).toEqual(["101", "102"]);
    expect(result.rows[0].line).toBe(1);
  });

  it("aceita nomes com vírgula entre aspas", () => {
    const result = parseStudentsCsv('Nome,Matrícula\n"Souza, Ana",10\n');
    expect(result.rows[0].fullName).toBe("Souza, Ana");
  });

  it("aponta linhas inválidas e importa as válidas", () => {
    const csv = "Nome;Matrícula\nAna Souza;1\nB;2\nCarla Dias;\nDavi Rocha;4#\n";
    const result = parseStudentsCsv(csv);
    expect(result.rows.map((r) => r.fullName)).toEqual(["Ana Souza"]);
    expect(result.errors).toEqual([
      { line: 3, message: "Informe o nome completo do aluno." },
      { line: 4, message: "Informe o número do aluno na turma." },
      { line: 5, message: "Use apenas letras, números e os símbolos . / _ - no número." },
    ]);
  });

  it("detecta matrícula repetida no arquivo, mesmo com formatação diferente", () => {
    const result = parseStudentsCsv("Nome;Matrícula\nAna Souza;20a1\nAna S.;20 A1\n");
    expect(result.rows).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      line: 3,
      message: "Número 20A1 repetido (já aparece na linha 2).",
    });
  });

  it("ignora linhas em branco", () => {
    const result = parseStudentsCsv("Nome;Matrícula\n\nAna Souza;1\n;\n\n");
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });

  it("pede os títulos quando o cabeçalho não é reconhecido", () => {
    const result = parseStudentsCsv("Estudante X;Código Y\nAna Souza;1\n");
    expect(result.fatal).toMatch(/Use os títulos "Nome" e "Número"/);
  });

  it("recusa arquivo vazio", () => {
    expect(parseStudentsCsv("  \n ").fatal).toBe("O arquivo está vazio.");
  });

  it("recusa arquivo só com cabeçalho", () => {
    expect(parseStudentsCsv("Nome;Matrícula\n").fatal).toBe("Nenhum aluno encontrado no arquivo.");
  });

  it("recusa arquivo com uma coluna só", () => {
    expect(parseStudentsCsv("Ana Souza 1\nBruno 2").fatal).toMatch(/duas colunas/);
  });

  it(`recusa mais de ${MAX_IMPORT_ROWS} alunos`, () => {
    const lines = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `Aluno Teste;${i + 1}`);
    expect(parseStudentsCsv(lines.join("\n")).fatal).toMatch(/no máximo 500/);
  });
});

describe("decodeCsvBytes", () => {
  it("lê UTF-8 (com BOM)", () => {
    const bytes = new TextEncoder().encode("﻿Nome;Matrícula\nJoão;1");
    expect(decodeCsvBytes(bytes.buffer)).toBe("Nome;Matrícula\nJoão;1");
  });

  it("lê Windows-1252, usado pelo Excel em português", () => {
    // "João;Matrícula" em Windows-1252: ã = 0xE3, í = 0xED
    const bytes = new Uint8Array([
      0x4a, 0x6f, 0xe3, 0x6f, 0x3b, 0x4d, 0x61, 0x74, 0x72, 0xed, 0x63, 0x75, 0x6c, 0x61,
    ]);
    expect(decodeCsvBytes(bytes.buffer)).toBe("João;Matrícula");
  });
});
