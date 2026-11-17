/**
 * Fila de salvamento das respostas do aluno.
 *
 * - Uma pendência por questão: a última alteração substitui as anteriores.
 * - Envia uma de cada vez; em falha de rede tenta de novo com espera crescente
 *   (1s, 2s, 4s… até 15s) e não perde a resposta.
 * - Texto (resposta curta/dissertativa) espera o aluno parar de digitar; escolhas
 *   são enviadas na hora.
 */

export type AnswerPayload = { questionId: string; selected: string[]; text: string | null };

/** ok: salvo; retry: falha temporária (rede); stop: o servidor recusou (ex.: prova encerrada). */
export type SendResult = "ok" | "retry" | "stop";

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "stopped";

type Timers = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

const MAX_BACKOFF_MS = 15_000;

export class SaveQueue {
  private pending = new Map<string, AnswerPayload>();
  private debounce = new Map<string, unknown>();
  private retryHandle: unknown = null;
  private sending = false;
  private stopped = false;
  private backoffMs = 1_000;

  constructor(
    private readonly send: (payload: AnswerPayload) => Promise<SendResult>,
    private readonly onStatus: (status: SaveStatus, pendingCount: number) => void,
    private readonly timers: Timers = {
      setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
      clearTimeout: (handle) => globalThis.clearTimeout(handle as number),
    },
  ) {}

  /** Agenda o salvamento; `delayMs` > 0 aguarda o fim da digitação. */
  enqueue(payload: AnswerPayload, delayMs = 0) {
    if (this.stopped) return;
    const existing = this.debounce.get(payload.questionId);
    if (existing !== undefined) this.timers.clearTimeout(existing);

    if (delayMs > 0) {
      this.pending.set(payload.questionId, payload);
      this.emit("saving");
      this.debounce.set(
        payload.questionId,
        this.timers.setTimeout(() => {
          this.debounce.delete(payload.questionId);
          void this.process();
        }, delayMs),
      );
      return;
    }

    this.debounce.delete(payload.questionId);
    this.pending.set(payload.questionId, payload);
    void this.process();
  }

  /** Envia tudo agora (ex.: antes de entregar a prova ou quando a rede volta). */
  async flush(): Promise<void> {
    for (const handle of this.debounce.values()) this.timers.clearTimeout(handle);
    this.debounce.clear();
    if (this.retryHandle !== null) {
      this.timers.clearTimeout(this.retryHandle);
      this.retryHandle = null;
    }
    this.backoffMs = 1_000;
    await this.process();
  }

  /** Respostas ainda não confirmadas pelo servidor (para guardar localmente). */
  snapshot(): AnswerPayload[] {
    return [...this.pending.values()];
  }

  stop() {
    this.stopped = true;
    for (const handle of this.debounce.values()) this.timers.clearTimeout(handle);
    this.debounce.clear();
    if (this.retryHandle !== null) this.timers.clearTimeout(this.retryHandle);
    this.emit("stopped");
  }

  private emit(status: SaveStatus) {
    this.onStatus(status, this.pending.size);
  }

  private nextReady(): AnswerPayload | undefined {
    for (const [questionId, payload] of this.pending) {
      if (!this.debounce.has(questionId)) return payload;
    }
    return undefined;
  }

  private async process(): Promise<void> {
    if (this.sending || this.stopped) return;
    this.sending = true;
    try {
      let next = this.nextReady();
      while (next && !this.stopped) {
        this.emit("saving");
        let result: SendResult;
        try {
          result = await this.send(next);
        } catch {
          result = "retry";
        }

        if (result === "stop") {
          this.stop();
          return;
        }
        if (result === "retry") {
          this.emit("offline");
          this.scheduleRetry();
          return;
        }

        // Só remove se não chegou uma versão mais nova durante o envio.
        if (this.pending.get(next.questionId) === next) this.pending.delete(next.questionId);
        this.backoffMs = 1_000;
        next = this.nextReady();
      }
      this.emit(this.pending.size === 0 ? "saved" : "saving");
    } finally {
      this.sending = false;
    }
  }

  private scheduleRetry() {
    if (this.retryHandle !== null) return;
    const wait = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    this.retryHandle = this.timers.setTimeout(() => {
      this.retryHandle = null;
      void this.process();
    }, wait);
  }
}
