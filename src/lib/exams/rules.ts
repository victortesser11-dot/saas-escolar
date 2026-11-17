/**
 * Regras de montagem da prova, espelhando a validação de publish_exam no banco.
 * Usadas para mostrar o resumo e os avisos ao professor antes de publicar.
 */

export type ExamRulesInput = {
  questionsPerAttempt: number | null;
  points: number[];
};

export type ExamSummary = {
  questionCount: number;
  /** Quantas questões cada aluno recebe. */
  perAttempt: number;
  /** Total de pontos da prova de cada aluno; null quando não é possível calcular. */
  studentTotal: number | null;
  /** Problemas que impedem a publicação. */
  issues: string[];
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function summarizeExam({ questionsPerAttempt, points }: ExamRulesInput): ExamSummary {
  const questionCount = points.length;
  const perAttempt = questionsPerAttempt ?? questionCount;
  const issues: string[] = [];
  const allEqual = points.every((p) => p === points[0]);

  if (questionCount === 0) {
    issues.push("Adicione ao menos uma questão.");
  }
  if (questionsPerAttempt !== null && questionsPerAttempt > questionCount && questionCount > 0) {
    issues.push(
      `Cada aluno deve receber ${questionsPerAttempt} questões, mas a prova tem só ${questionCount}.`,
    );
  }
  if (questionsPerAttempt !== null && questionsPerAttempt < questionCount && !allEqual) {
    issues.push(
      "Quando cada aluno recebe só parte das questões, todas precisam ter o mesmo valor (senão as notas máximas ficariam diferentes).",
    );
  }

  let studentTotal: number | null = null;
  if (questionCount > 0) {
    if (perAttempt >= questionCount) {
      studentTotal = round2(points.reduce((sum, p) => sum + p, 0));
    } else if (allEqual) {
      studentTotal = round2(points[0] * perAttempt);
    }
  }

  return { questionCount, perAttempt: Math.min(perAttempt, questionCount), studentTotal, issues };
}

export type AssignmentStatus = "scheduled" | "open" | "closed";

export function assignmentStatus(
  assignment: { opensAt: string; closesAt: string; closedAt: string | null },
  now: Date = new Date(),
): AssignmentStatus {
  if (assignment.closedAt && new Date(assignment.closedAt) <= now) return "closed";
  if (new Date(assignment.closesAt) <= now) return "closed";
  if (new Date(assignment.opensAt) > now) return "scheduled";
  return "open";
}

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  scheduled: "Agendada",
  open: "Aberta",
  closed: "Encerrada",
};
