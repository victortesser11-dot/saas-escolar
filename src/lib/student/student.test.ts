import { describe, expect, it, vi } from "vitest";
import { entryErrorMessage, CONNECTION_ERROR } from "./messages";
import { SaveQueue, type AnswerPayload, type SendResult } from "./save-queue";
import { clockOffsetMs, formatRemaining, remainingMs, timerUrgency } from "./timer";

describe("cronômetro", () => {
  it("compensa o relógio errado do celular", () => {
    // Celular 2 minutos adiantado em relação ao servidor.
    const clientNow = Date.parse("2026-11-20T12:02:00Z");
    const offset = clockOffsetMs("2026-11-20T12:00:00Z", clientNow);
    expect(remainingMs("2026-11-20T12:40:00Z", offset, clientNow)).toBe(40 * 60_000);
  });

  it("nunca fica negativo", () => {
    expect(remainingMs("2026-11-20T12:00:00Z", 0, Date.parse("2026-11-20T13:00:00Z"))).toBe(0);
  });

  it("formata minutos e horas", () => {
    expect(formatRemaining(65_000)).toBe("01:05");
    expect(formatRemaining(3_725_000)).toBe("1:02:05");
    expect(formatRemaining(400)).toBe("00:01");
    expect(formatRemaining(0)).toBe("00:00");
  });

  it("alerta nos últimos minutos", () => {
    expect(timerUrgency(10 * 60_000)).toBe("normal");
    expect(timerUrgency(4 * 60_000)).toBe("warning");
    expect(timerUrgency(30_000)).toBe("critical");
  });
});

describe("mensagens de entrada", () => {
  it("traduz códigos conhecidos e cai na mensagem de conexão", () => {
    expect(entryErrorMessage("closed")).toBe("Esta prova já foi encerrada.");
    expect(entryErrorMessage("xyz")).toBe(CONNECTION_ERROR);
  });
});

describe("SaveQueue", () => {
  const answer = (questionId: string, text: string): AnswerPayload => ({
    questionId,
    selected: [],
    text,
  });

  it("salva a última versão de cada questão", async () => {
    vi.useFakeTimers();
    const sent: AnswerPayload[] = [];
    const queue = new SaveQueue(
      async (p) => {
        sent.push(p);
        return "ok";
      },
      () => {},
    );

    queue.enqueue(answer("q1", "a"), 500);
    queue.enqueue(answer("q1", "ab"), 500);
    queue.enqueue(answer("q1", "abc"), 500);
    await vi.advanceTimersByTimeAsync(600);

    expect(sent).toEqual([answer("q1", "abc")]);
    vi.useRealTimers();
  });

  it("tenta de novo quando a rede falha e não perde a resposta", async () => {
    vi.useFakeTimers();
    const results: SendResult[] = ["retry", "retry", "ok"];
    const statuses: string[] = [];
    const send = vi.fn(async () => results.shift() ?? "ok");
    const queue = new SaveQueue(send, (status) => statuses.push(status));

    queue.enqueue(answer("q1", "resposta"));
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses).toContain("offline");
    expect(queue.snapshot()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1_000); // 1ª nova tentativa
    await vi.advanceTimersByTimeAsync(2_000); // 2ª nova tentativa (espera dobrada)
    expect(send).toHaveBeenCalledTimes(3);
    expect(queue.snapshot()).toHaveLength(0);
    expect(statuses.at(-1)).toBe("saved");
    vi.useRealTimers();
  });

  it("flush envia na hora o que estava esperando digitação", async () => {
    vi.useFakeTimers();
    const send = vi.fn(async (): Promise<SendResult> => "ok");
    const queue = new SaveQueue(send, () => {});
    queue.enqueue(answer("q1", "texto"), 5_000);
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("para quando o servidor recusa (prova encerrada)", async () => {
    const statuses: string[] = [];
    const queue = new SaveQueue(
      async () => "stop",
      (status) => statuses.push(status),
    );
    queue.enqueue(answer("q1", "x"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(statuses.at(-1)).toBe("stopped");
    queue.enqueue(answer("q2", "y"));
    expect(queue.snapshot().some((p) => p.questionId === "q2")).toBe(false);
  });

  it("não descarta a versão nova que chegou durante o envio", async () => {
    let release: (value: SendResult) => void = () => {};
    const sent: AnswerPayload[] = [];
    const queue = new SaveQueue(
      (p) => {
        sent.push(p);
        return new Promise<SendResult>((resolve) => {
          release = resolve;
        });
      },
      () => {},
    );
    queue.enqueue(answer("q1", "v1"));
    queue.enqueue(answer("q1", "v2")); // chega enquanto v1 está sendo enviada
    release("ok");
    await new Promise((resolve) => setTimeout(resolve, 0));
    release("ok");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent.map((p) => p.text)).toEqual(["v1", "v2"]);
  });
});
