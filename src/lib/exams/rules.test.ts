import { describe, expect, it } from "vitest";
import { assignmentStatus, summarizeExam } from "./rules";

describe("summarizeExam", () => {
  it("soma os valores quando todos recebem todas as questões", () => {
    expect(summarizeExam({ questionsPerAttempt: null, points: [1, 1.5, 2.5] })).toEqual({
      questionCount: 3,
      perAttempt: 3,
      studentTotal: 5,
      issues: [],
    });
  });

  it("calcula o total do aluno quando há sorteio com valores iguais", () => {
    const summary = summarizeExam({ questionsPerAttempt: 10, points: Array(20).fill(1) });
    expect(summary.perAttempt).toBe(10);
    expect(summary.studentTotal).toBe(10);
    expect(summary.issues).toEqual([]);
  });

  it("bloqueia sorteio parcial com valores diferentes (Q-01)", () => {
    const summary = summarizeExam({ questionsPerAttempt: 2, points: [1, 1, 2] });
    expect(summary.studentTotal).toBeNull();
    expect(summary.issues[0]).toMatch(/mesmo valor/);
  });

  it("aceita valores diferentes quando todos recebem todas", () => {
    expect(summarizeExam({ questionsPerAttempt: 3, points: [1, 1, 2] }).issues).toEqual([]);
  });

  it("acusa sorteio maior que o número de questões", () => {
    const summary = summarizeExam({ questionsPerAttempt: 5, points: [1, 1] });
    expect(summary.issues[0]).toBe("Cada aluno deve receber 5 questões, mas a prova tem só 2.");
    expect(summary.perAttempt).toBe(2);
  });

  it("acusa prova vazia", () => {
    const summary = summarizeExam({ questionsPerAttempt: null, points: [] });
    expect(summary.issues).toEqual(["Adicione ao menos uma questão."]);
    expect(summary.studentTotal).toBeNull();
  });

  it("evita erro de arredondamento", () => {
    expect(summarizeExam({ questionsPerAttempt: null, points: [0.1, 0.2] }).studentTotal).toBe(0.3);
  });
});

describe("assignmentStatus", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const base = {
    opensAt: "2026-11-20T10:00:00Z",
    closesAt: "2026-11-20T14:00:00Z",
    closedAt: null,
  };

  it("aberta dentro do período", () => {
    expect(assignmentStatus(base, now)).toBe("open");
  });

  it("agendada antes de abrir", () => {
    expect(
      assignmentStatus(
        { ...base, opensAt: "2026-11-21T10:00:00Z", closesAt: "2026-11-21T12:00:00Z" },
        now,
      ),
    ).toBe("scheduled");
  });

  it("encerrada após o prazo ou manualmente", () => {
    expect(assignmentStatus({ ...base, closesAt: "2026-11-20T11:00:00Z" }, now)).toBe("closed");
    expect(assignmentStatus({ ...base, closedAt: "2026-11-20T11:30:00Z" }, now)).toBe("closed");
  });
});
