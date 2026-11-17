import { describe, expect, it } from "vitest";
import { parseTags, questionSchema, toQuestionErrors, type QuestionInput } from "./schema";

const base: QuestionInput = {
  type: "single_choice",
  stem: "  Quanto é 3/4 de 1/2?  ",
  explanation: "",
  points: "1,5",
  tags: "Frações, 7º  ano, frações",
  options: [
    { body: "3/8", isCorrect: true },
    { body: "1/2", isCorrect: false },
  ],
};

function errorsOf(input: QuestionInput) {
  const result = questionSchema.safeParse(input);
  expect(result.success).toBe(false);
  return result.success ? {} : toQuestionErrors(result.error);
}

describe("questionSchema", () => {
  it("normaliza enunciado, pontuação, assuntos e resolução vazia", () => {
    const data = questionSchema.parse(base);
    expect(data.stem).toBe("Quanto é 3/4 de 1/2?");
    expect(data.points).toBe(1.5);
    expect(data.tags).toEqual(["frações", "7º ano"]);
    expect(data.explanation).toBeNull();
  });

  it("múltipla escolha exige exatamente uma correta", () => {
    expect(
      errorsOf({ ...base, options: base.options.map((o) => ({ ...o, isCorrect: false })) }).options,
    ).toBe("Marque qual é a alternativa correta.");
    expect(
      errorsOf({ ...base, options: base.options.map((o) => ({ ...o, isCorrect: true })) }).options,
    ).toBe("Marque qual é a alternativa correta.");
  });

  it("exige ao menos 2 alternativas", () => {
    expect(errorsOf({ ...base, options: [{ body: "3/8", isCorrect: true }] }).options).toBe(
      "Cadastre ao menos 2 alternativas.",
    );
  });

  it("aponta alternativa vazia e repetida", () => {
    const errors = errorsOf({
      ...base,
      options: [
        { body: "3/8", isCorrect: true },
        { body: " ", isCorrect: false },
        { body: "3/8 ", isCorrect: false },
      ],
    });
    expect(errors["options.1.body"]).toBe("Preencha a alternativa ou remova-a.");
    expect(errors["options.2.body"]).toBe("Repetida: igual a outra alternativa.");
  });

  it("seleção múltipla aceita várias corretas, mas exige ao menos uma", () => {
    const options = [
      { body: "2", isCorrect: true },
      { body: "3", isCorrect: true },
      { body: "4", isCorrect: false },
    ];
    expect(questionSchema.safeParse({ ...base, type: "multiple_choice", options }).success).toBe(
      true,
    );
    expect(
      errorsOf({
        ...base,
        type: "multiple_choice",
        options: options.map((o) => ({ ...o, isCorrect: false })),
      }).options,
    ).toBe("Marque ao menos uma alternativa correta.");
  });

  it("verdadeiro ou falso grava os textos padrão", () => {
    const data = questionSchema.parse({
      ...base,
      type: "true_false",
      options: [
        { body: "", isCorrect: false },
        { body: "", isCorrect: true },
      ],
    });
    expect(data.options).toEqual([
      { body: "Verdadeiro", isCorrect: false },
      { body: "Falso", isCorrect: true },
    ]);
  });

  it("verdadeiro ou falso exige a marcação", () => {
    expect(
      errorsOf({
        ...base,
        type: "true_false",
        options: [
          { body: "", isCorrect: false },
          { body: "", isCorrect: false },
        ],
      }).options,
    ).toBe("Marque se a afirmação é verdadeira ou falsa.");
  });

  it("resposta curta: todas as respostas cadastradas são aceitas", () => {
    const data = questionSchema.parse({
      ...base,
      type: "short_answer",
      options: [
        { body: "Brasília", isCorrect: false },
        { body: "Brasilia DF", isCorrect: false },
      ],
    });
    expect(data.options.every((o) => o.isCorrect)).toBe(true);
  });

  it("resposta curta: variações só de acento/maiúscula contam como repetidas", () => {
    expect(
      errorsOf({
        ...base,
        type: "short_answer",
        options: [
          { body: "Brasília", isCorrect: true },
          { body: "BRASILIA", isCorrect: true },
        ],
      })["options.1.body"],
    ).toBe("Repetida: igual a outra alternativa.");
  });

  it("resposta curta exige ao menos uma resposta", () => {
    expect(errorsOf({ ...base, type: "short_answer", options: [] }).options).toBe(
      "Cadastre ao menos uma resposta aceita.",
    );
  });

  it("dissertativa descarta alternativas e guarda os critérios", () => {
    const data = questionSchema.parse({
      ...base,
      type: "essay",
      explanation: " Citar luz, água e CO2. ",
    });
    expect(data.options).toEqual([]);
    expect(data.explanation).toBe("Citar luz, água e CO2.");
  });

  it("valida enunciado e pontuação", () => {
    const errors = errorsOf({ ...base, stem: "   ", points: "0" });
    expect(errors.stem).toBe("Escreva o enunciado da questão.");
    expect(errors.points).toMatch(/Informe um valor entre 0,01 e 100/);
  });
});

describe("parseTags", () => {
  it("separa por vírgula, ponto e vírgula ou linha", () => {
    expect(parseTags("Frações; geometria\n Frações ,")).toEqual(["frações", "geometria"]);
  });
});
