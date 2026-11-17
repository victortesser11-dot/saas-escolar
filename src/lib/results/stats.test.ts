import { describe, expect, it } from "vitest";
import { bandOf, histogram, percentOf, situationOf, summarize } from "./stats";

describe("percentOf", () => {
  it("converte pontos em aproveitamento", () => {
    expect(percentOf(6.5, 10)).toBe(65);
    expect(percentOf(2, 3)).toBe(66.7);
  });

  it("devolve null sem nota ou sem máximo", () => {
    expect(percentOf(null, 10)).toBeNull();
    expect(percentOf(5, 0)).toBeNull();
  });
});

describe("bandOf", () => {
  it("classifica nas três faixas", () => {
    expect(bandOf(70)).toBe("good");
    expect(bandOf(69.9)).toBe("attention");
    expect(bandOf(50)).toBe("attention");
    expect(bandOf(49.9)).toBe("low");
  });
});

describe("summarize", () => {
  it("calcula média, mediana, mínimo e máximo", () => {
    expect(summarize([40, 90, 60, 70])).toEqual({
      count: 4,
      mean: 65,
      median: 65,
      min: 40,
      max: 90,
    });
  });

  it("mediana com número ímpar", () => {
    expect(summarize([10, 50, 30]).median).toBe(30);
  });

  it("lista vazia", () => {
    expect(summarize([])).toEqual({ count: 0, mean: null, median: null, min: null, max: null });
  });
});

describe("histogram", () => {
  it("distribui em 5 faixas e coloca 100% na última", () => {
    const bins = histogram([0, 19.9, 20, 55, 79.9, 80, 100]);
    expect(bins.map((b) => b.count)).toEqual([2, 1, 1, 1, 2]);
    expect(bins[4].label).toBe("80–100%");
  });
});

describe("situationOf", () => {
  it("sem aplicação: não iniciou ou não fez (turma encerrada)", () => {
    expect(situationOf(null, false)).toBe("not_started");
    expect(situationOf(null, true)).toBe("absent");
  });

  it("prioriza o que pede ação do professor", () => {
    expect(situationOf({ status: "interrupted", gradingStatus: null }, false)).toBe("interrupted");
    expect(situationOf({ status: "submitted", gradingStatus: "pending_review" }, false)).toBe(
      "pending_review",
    );
    expect(situationOf({ status: "expired", gradingStatus: "graded" }, true)).toBe("expired");
    expect(situationOf({ status: "submitted", gradingStatus: "graded" }, true)).toBe("graded");
  });
});
