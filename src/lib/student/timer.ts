/**
 * Cronômetro do aluno. O prazo vem do servidor (expires_at) junto com a hora do
 * servidor (server_now); a diferença para o relógio do celular é compensada,
 * para que um relógio errado no aparelho não altere o tempo da prova.
 */

export function clockOffsetMs(serverNowIso: string, clientNowMs: number = Date.now()): number {
  return Date.parse(serverNowIso) - clientNowMs;
}

export function remainingMs(
  expiresAtIso: string,
  offsetMs: number,
  clientNowMs: number = Date.now(),
) {
  return Math.max(0, Date.parse(expiresAtIso) - (clientNowMs + offsetMs));
}

/** 65_000 → "01:05"; 3_725_000 → "1:02:05". Arredonda para cima (nunca mostra 00:00 antes do fim). */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** Nível de alerta do cronômetro: últimos 5 minutos e último minuto. */
export function timerUrgency(ms: number): "normal" | "warning" | "critical" {
  if (ms <= 60_000) return "critical";
  if (ms <= 5 * 60_000) return "warning";
  return "normal";
}
