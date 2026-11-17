import { describe, expect, it } from "vitest";
import { formatPoints, parsePoints, pointsLabel } from "./points";
import { matchesShortAnswer, normalizeShortAnswer } from "./short-answer";
import { optionLetter } from "./types";

describe("parsePoints", () => {
  it.each([
    ["1", 1],
    ["1,5", 1.5],
    ["0.25", 0.25],
    [" 10 ", 10],
    ["100", 100],
  ])("aceita %s", (raw, expected) => {
    expect(parsePoints(raw)).toBe(expected);
  });

  it.each(["0", "-1", "101", "1,555", "abc", "", "1e2"])("rejeita %s", (raw) => {
    expect(parsePoints(raw)).toBeNull();
  });
});

describe("formatPoints", () => {
  it("usa vírgula decimal e plural", () => {
    expect(formatPoints(1.5)).toBe("1,5");
    expect(pointsLabel(1)).toBe("1 ponto");
    expect(pointsLabel(2.25)).toBe("2,25 pontos");
  });
});

describe("respostas curtas", () => {
  it("ignora maiúsculas, acentos, espaços e pontuação nas pontas", () => {
    expect(normalizeShortAnswer("  Brasília. ")).toBe("brasilia");
    expect(normalizeShortAnswer("São   Paulo")).toBe("sao paulo");
  });

  it("trata vírgula e ponto decimal como iguais", () => {
    expect(matchesShortAnswer("0,5", ["0.5"])).toBe(true);
  });

  it("compara com qualquer resposta aceita", () => {
    expect(matchesShortAnswer("brasilia df", ["Brasília", "Brasília DF"])).toBe(true);
    expect(matchesShortAnswer("Rio de Janeiro", ["Brasília"])).toBe(false);
  });

  it("resposta vazia nunca é correta", () => {
    expect(matchesShortAnswer("  ", [""])).toBe(false);
  });
});

describe("optionLetter", () => {
  it("gera A, B, C…", () => {
    expect([0, 1, 2, 9].map(optionLetter)).toEqual(["A", "B", "C", "J"]);
  });
});
