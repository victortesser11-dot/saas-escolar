/** Pontuação de questões: aceita vírgula decimal (1,5) e no máximo 2 casas. */

export const MAX_POINTS = 100;

export function parsePoints(raw: string): number | null {
  const value = raw.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(value)) return null;
  const points = Number(value);
  if (!Number.isFinite(points) || points <= 0 || points > MAX_POINTS) return null;
  return points;
}

const formatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** 1.5 → "1,5"; 2 → "2". */
export function formatPoints(points: number): string {
  return formatter.format(points);
}

export function pointsLabel(points: number): string {
  return `${formatPoints(points)} ${points === 1 ? "ponto" : "pontos"}`;
}
