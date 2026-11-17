/**
 * Indicadores de desempenho para o dashboard do professor.
 * Notas são comparadas em aproveitamento (% da nota máxima), para que provas de
 * valores diferentes possam ser lidas na mesma escala.
 */

export type Band = "good" | "attention" | "low";

export const BAND_LABEL: Record<Band, string> = {
  good: "70% ou mais",
  attention: "50% a 69%",
  low: "Abaixo de 50%",
};

/** Aproveitamento de 0 a 100 com uma casa decimal; null sem nota. */
export function percentOf(score: number | null, max: number | null): number | null {
  if (score === null || max === null || max <= 0) return null;
  return Math.round((score / max) * 1000) / 10;
}

export function bandOf(percent: number): Band {
  if (percent >= 70) return "good";
  if (percent >= 50) return "attention";
  return "low";
}

export type Summary = {
  count: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

export function summarize(values: number[]): Summary {
  if (values.length === 0) return { count: 0, mean: null, median: null, min: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return {
    count: sorted.length,
    mean: round1(sorted.reduce((sum, v) => sum + v, 0) / sorted.length),
    median: round1(median),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

export type Bin = { label: string; from: number; to: number; count: number };

/** Distribuição em 5 faixas de 20 pontos percentuais (a última inclui 100%). */
export function histogram(percents: number[]): Bin[] {
  const bins: Bin[] = [0, 20, 40, 60, 80].map((from) => ({
    label: `${from}–${from === 80 ? 100 : from + 19}%`,
    from,
    to: from + 20,
    count: 0,
  }));
  for (const p of percents) {
    const index = Math.min(4, Math.max(0, Math.floor(p / 20)));
    bins[index].count += 1;
  }
  return bins;
}

export type Situation =
  | "not_started"
  | "absent"
  | "in_progress"
  | "interrupted"
  | "pending_review"
  | "graded"
  | "expired";

export const SITUATION_LABEL: Record<Situation, string> = {
  not_started: "Não iniciou",
  absent: "Não fez",
  in_progress: "Fazendo",
  interrupted: "Interrompida",
  pending_review: "Aguarda correção",
  graded: "Concluída",
  expired: "Encerrada pelo tempo",
};

type AttemptLike = {
  status: "in_progress" | "interrupted" | "submitted" | "expired" | "superseded";
  gradingStatus: "pending_review" | "graded" | null;
};

/** Situação do aluno na aplicação, para o quadro de acompanhamento (RF-48). */
export function situationOf(attempt: AttemptLike | null, assignmentClosed: boolean): Situation {
  if (!attempt) return assignmentClosed ? "absent" : "not_started";
  if (attempt.status === "in_progress") return "in_progress";
  if (attempt.status === "interrupted") return "interrupted";
  if (attempt.gradingStatus === "pending_review") return "pending_review";
  if (attempt.status === "expired") return "expired";
  return "graded";
}

/** Ordem de prioridade no quadro: o que exige ação do professor vem primeiro. */
export const SITUATION_ORDER: Situation[] = [
  "interrupted",
  "pending_review",
  "in_progress",
  "not_started",
  "expired",
  "graded",
  "absent",
];
