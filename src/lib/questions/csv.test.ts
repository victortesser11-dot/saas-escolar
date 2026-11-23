import { describe, expect, it } from "vitest";
import { parseLetters, parseQuestionsCsv, QUESTIONS_TEMPLATE_CSV } from "./csv";

const HEADER = "Tipo;Enunciado;A;B;C;D;E;Correta;Valor;Explicação\n";

describe("parseLetters", () => {
  it("entende os jeitos comuns de escrever o gabarito", () => {
    expect(parseLetters("b")).toEqual(["B"]);
    expect(parseLetters("Letra C")).toEqual(["C"]);
    expect(parseLetters("A, C")).toEqual(["A", "C"]);
    expect(parseLetters("a e c")).toEqual(["A", "C"]);
    expect(parseLetters("AC")).toEqual(["A", "C"]);
    expect(parseLetters("E")).toEqual(["E"]);
    expect(parseLetters("Brasília")).toBeNull();
  });
});

describe("parseQuestionsCsv", () => {
  it("lê a planilha modelo inteira, um exemplo de cada tipo", () => {
    const result = parseQuestionsCsv(QUESTIONS_TEMPLATE_CSV.replace(/^\uFEFF/, ""));
    expect(result.errors).toEqual([]);
    expect(result.rows.map((r) => r.type)).toEqual([
      "single_choice",
      "multiple_choice",
      "true_false",
      "short_answer",
      "essay",
    ]);
    const [single, multiple, tf, short, essay] = result.rows;
    expect(single.options.map((o) => o.isCorrect)).toEqual([false, true, false, false]);
    expect(multiple.options.filter((o) => o.isCorrect).map((o) => o.body)).toEqual(["2", "7"]);
    expect(tf.options).toEqual([
      { body: "Verdadeiro", isCorrect: true },
      { body: "Falso", isCorrect: false },
    ]);
    expect(short.options).toEqual([{ body: "Brasília", isCorrect: true }]);
    expect(essay.points).toBe("2");
    expect(essay.options).toEqual([]);
    expect(single.line).toBe(2);
  });

  it("deduz o tipo quando a coluna Tipo fica vazia e usa valor 1 por padrão", () => {
    const csv =
      HEADER +
      ";Uma correta?;x;y;;;;A;;\n" +
      ";Duas corretas?;x;y;z;;;A e C;;\n" +
      ";Afirmação.;;;;;;F;;\n" +
      ';Capital?;;;;;;"Brasília; brasilia; BSB";;\n' +
      ";Explique.;;;;;;;;\n";
    const result = parseQuestionsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows.map((r) => [r.type, r.points])).toEqual([
      ["single_choice", "1"],
      ["multiple_choice", "1"],
      ["true_false", "1"],
      ["short_answer", "1"],
      ["essay", "1"],
    ]);
    expect(result.rows[3].options.map((o) => o.body)).toEqual(["Brasília", "BSB"]);
  });

  it("aponta o problema de cada linha, sem descartar as boas", () => {
    const csv =
      HEADER +
      "Múltipla escolha;Sem gabarito;x;y;;;;;1;\n" +
      "Múltipla escolha;Letra inexistente;x;y;;;;D;1;\n" +
      "ME;Duas letras;x;y;;;;A,B;1;\n" +
      "Prova oral;Tipo estranho;;;;;;;1;\n" +
      "VF;Sem V ou F;;;;;;talvez;1;\n" +
      "ME;Buraco;x;;z;;;A;1;\n" +
      "ME;Valor ruim;x;y;;;;A;abc;\n" +
      "ME;;x;y;;;;A;1;\n" +
      "ME;Boa;x;y;;;;B;1,5;\n";
    const result = parseQuestionsCsv(csv);
    expect(result.rows.map((r) => r.stem)).toEqual(["Boa"]);
    expect(result.rows[0].points).toBe("1,5");
    expect(result.errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result.errors[0].message).toMatch(/informe a letra/);
    expect(result.errors[1].message).toBe("A alternativa D, marcada como correta, está vazia.");
    expect(result.errors[2].message).toMatch(/Seleção múltipla/);
    expect(result.errors[3].message).toMatch(/Tipo "Prova oral" não reconhecido/);
    expect(result.errors[4].message).toMatch(/V \(verdadeiro\) ou F/);
    expect(result.errors[5].message).toMatch(/^Alternativa B:/);
    expect(result.errors[6].message).toMatch(/^Valor:/);
    expect(result.errors[7].message).toBe("Escreva o enunciado da questão.");
  });

  it("aceita vírgula como separador e títulos alternativos", () => {
    const csv = 'Pergunta,Alternativa A,Alternativa B,Gabarito,Pontos\n"Quanto é 1+1?",2,3,A,2\n';
    const result = parseQuestionsCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      type: "single_choice",
      stem: "Quanto é 1+1?",
      points: "2",
    });
  });

  it("recusa arquivo sem a coluna de enunciado", () => {
    expect(parseQuestionsCsv("Nome;Número\nAna;1\n").fatal).toMatch(/coluna "Enunciado"/);
  });
});
