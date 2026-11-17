"use client";

import { ArrowLeft, ArrowRight, Check, CloudOff, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormMessage } from "@/components/form/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { pluralize } from "@/lib/classes/messages";
import { formatPoints } from "@/lib/questions/points";
import { optionLetter } from "@/lib/questions/types";
import {
  getAttempt,
  saveAnswer,
  submitAttempt,
  type AttemptResult,
  type AttemptState,
  type SavedAnswer,
  type StudentQuestion,
} from "@/lib/student/api";
import { SaveQueue, type AnswerPayload, type SaveStatus } from "@/lib/student/save-queue";
import { clockOffsetMs, formatRemaining, remainingMs, timerUrgency } from "@/lib/student/timer";
import { cn } from "@/lib/utils";

export type InProgressAttempt = Extract<AttemptState, { status: "in_progress" }>;

const TEXT_DEBOUNCE_MS = 800;
const pendingKey = (code: string) => `prova:${code}:pendentes`;

function readPending(code: string): AnswerPayload[] {
  try {
    return JSON.parse(sessionStorage.getItem(pendingKey(code)) ?? "[]") as AnswerPayload[];
  } catch {
    return [];
  }
}

function writePending(code: string, pending: AnswerPayload[]) {
  try {
    if (pending.length === 0) sessionStorage.removeItem(pendingKey(code));
    else sessionStorage.setItem(pendingKey(code), JSON.stringify(pending));
  } catch {
    // Sem armazenamento local: as respostas continuam na fila em memória.
  }
}

function isAnswered(question: StudentQuestion, answer: SavedAnswer | undefined) {
  if (!answer) return false;
  if (question.type === "short_answer" || question.type === "essay") {
    return (answer.text ?? "").trim() !== "";
  }
  return answer.selected.length > 0;
}

export function ExamTaker({
  code,
  token,
  attempt,
  onFinished,
  onInterrupted,
}: {
  code: string;
  token: string;
  attempt: InProgressAttempt;
  onFinished: (result: AttemptResult) => void;
  onInterrupted: () => void;
}) {
  const questions = attempt.questions;

  // Respostas: as do servidor, sobrepostas pelas que ficaram pendentes nesta aba.
  const [answers, setAnswers] = useState<Record<string, SavedAnswer>>(() => {
    const merged = { ...attempt.answers };
    for (const p of readPending(code))
      merged[p.questionId] = { selected: p.selected, text: p.text };
    return merged;
  });
  const [index, setIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [offset] = useState(() => clockOffsetMs(attempt.server_now));
  const [now, setNow] = useState(() => Date.now());
  const finishingRef = useRef(false);

  /** Recarrega o estado pelo servidor (prova encerrada, interrompida…). */
  const refreshFromServer = useCallback(async () => {
    const state = await getAttempt(token);
    if ("error" in state) return;
    if (state.status === "interrupted") onInterrupted();
    else if (state.status === "submitted" || state.status === "expired") onFinished(state.result);
  }, [token, onFinished, onInterrupted]);

  const [queue] = useState(
    () =>
      new SaveQueue(
        async (payload) => {
          const response = await saveAnswer(token, payload.questionId, {
            selected: payload.selected,
            text: payload.text,
          });
          if ("ok" in response) return "ok";
          if (response.error === "connection") return "retry";
          void refreshFromServer();
          return "stop";
        },
        (status) => setSaveStatus(status),
      ),
  );

  // Guarda localmente o que ainda não foi confirmado e reenvia o que ficou de uma recarga.
  useEffect(() => {
    writePending(code, queue.snapshot());
  }, [code, queue, saveStatus]);

  useEffect(() => {
    for (const p of readPending(code)) queue.enqueue(p);
    const onOnline = () => void queue.flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [code, queue]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = remainingMs(attempt.expires_at, offset, now);
  const urgency = timerUrgency(remaining);

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setSubmitting(true);
    setSubmitError(undefined);
    await queue.flush();
    const response = await submitAttempt(token);
    if ("error" in response) {
      finishingRef.current = false;
      setSubmitting(false);
      if (response.error === "interrupted") onInterrupted();
      else
        setSubmitError("Não conseguimos enviar. Verifique a internet e toque em enviar de novo.");
      return;
    }
    queue.stop();
    writePending(code, []);
    onFinished(response.result);
  }, [code, queue, token, onFinished, onInterrupted]);

  // Tempo esgotado: envia o que já foi respondido (RN-15, RF-43).
  useEffect(() => {
    if (remaining === 0 && !finishingRef.current) void finish();
  }, [remaining, finish]);

  const answeredCount = useMemo(
    () => questions.filter((q) => isAnswered(q, answers[q.id])).length,
    [questions, answers],
  );

  function update(question: StudentQuestion, answer: SavedAnswer, delay = 0) {
    setAnswers((current) => ({ ...current, [question.id]: answer }));
    queue.enqueue({ questionId: question.id, selected: answer.selected, text: answer.text }, delay);
  }

  function choose(question: StudentQuestion, optionId: string) {
    const current = answers[question.id]?.selected ?? [];
    const selected =
      question.type === "multiple_choice"
        ? current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId]
        : [optionId];
    update(question, { selected, text: null });
  }

  function goTo(next: number) {
    setReviewing(false);
    setConfirming(false);
    setIndex(next);
    window.scrollTo({ top: 0 });
  }

  const question = questions[index];
  const answer = answers[question?.id];
  const isLast = index === questions.length - 1;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
      {/* Barra superior: posição, cronômetro, progresso e salvamento */}
      <header className="sticky top-0 z-10 grid gap-3 border-b-[1.5px] border-foreground bg-background px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center justify-between gap-3">
          <span className="label-mono text-muted-foreground">
            {reviewing ? "Revisão" : `Questão ${index + 1} de ${questions.length}`}
          </span>
          <span
            role="timer"
            aria-label={`Tempo restante ${formatRemaining(remaining)}`}
            className={cn(
              "rounded-sm border-[1.5px] px-2 py-0.5 font-mono text-sm tabular-nums",
              urgency === "normal" && "border-foreground bg-card",
              urgency === "warning" && "border-foreground bg-mark",
              urgency === "critical" && "animate-pulse border-pen bg-pen text-white",
            )}
          >
            {formatRemaining(remaining)}
          </span>
        </div>
        <nav aria-label="Questões" className="flex gap-1">
          {questions.map((q, i) => {
            const done = isAnswered(q, answers[q.id]);
            const current = !reviewing && i === index;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir para a questão ${i + 1}${done ? ", respondida" : ", em branco"}`}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "h-2.5 min-w-0 flex-1 rounded-[2px] border-[1.5px] border-foreground outline-none focus-visible:ring-4 focus-visible:ring-ring",
                  current ? "bg-mark" : done ? "bg-foreground" : "bg-card",
                )}
              />
            );
          })}
        </nav>
        <SaveIndicator status={saveStatus} />
      </header>

      <main className="flex flex-1 flex-col px-4 pt-6 pb-4">
        {reviewing ? (
          <Review
            questions={questions}
            answers={answers}
            answeredCount={answeredCount}
            onOpen={goTo}
            confirming={confirming}
            setConfirming={setConfirming}
            submitting={submitting}
            submitError={submitError}
            onSubmit={() => void finish()}
          />
        ) : question ? (
          <article className="grid gap-5" aria-labelledby={`enunciado-${question.id}`}>
            <p className="label-mono text-muted-foreground">
              {formatPoints(question.points)} {question.points === 1 ? "ponto" : "pontos"}
              {question.type === "multiple_choice" ? " · marque todas as corretas" : null}
            </p>
            <h1
              id={`enunciado-${question.id}`}
              className="text-lg leading-relaxed font-medium break-words whitespace-pre-line"
            >
              {question.stem}
            </h1>
            <AnswerArea
              question={question}
              answer={answer}
              onChoose={(id) => choose(question, id)}
              onText={(text, delay) => update(question, { selected: [], text }, delay)}
            />
          </article>
        ) : null}
      </main>

      {reviewing ? null : (
        <footer className="sticky bottom-0 grid grid-cols-[1fr_1.4fr] gap-2 border-t-[1.5px] border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12"
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
          >
            <ArrowLeft aria-hidden />
            Anterior
          </Button>
          {isLast ? (
            <Button
              type="button"
              size="lg"
              className="h-12"
              onClick={() => {
                setReviewing(true);
                window.scrollTo({ top: 0 });
              }}
            >
              Revisar e enviar
            </Button>
          ) : (
            <Button type="button" size="lg" className="h-12" onClick={() => goTo(index + 1)}>
              Próxima
              <ArrowRight aria-hidden />
            </Button>
          )}
        </footer>
      )}
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <p aria-live="polite" className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {status === "saving" ? (
        <>
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          Salvando…
        </>
      ) : status === "offline" ? (
        <span className="flex items-center gap-1.5 text-pen">
          <CloudOff className="size-3.5" aria-hidden />
          Sem conexão. Suas respostas serão salvas quando a internet voltar.
        </span>
      ) : status === "saved" ? (
        <>
          <Check className="size-3.5 text-ok" aria-hidden />
          Respostas salvas
        </>
      ) : null}
    </p>
  );
}

function AnswerArea({
  question,
  answer,
  onChoose,
  onText,
}: {
  question: StudentQuestion;
  answer: SavedAnswer | undefined;
  onChoose: (optionId: string) => void;
  onText: (text: string, delay: number) => void;
}) {
  const selected = answer?.selected ?? [];

  if (question.type === "short_answer") {
    return (
      <Input
        aria-label="Sua resposta"
        value={answer?.text ?? ""}
        onChange={(e) => onText(e.target.value, TEXT_DEBOUNCE_MS)}
        maxLength={500}
        autoComplete="off"
        placeholder="Digite sua resposta"
        className="h-12 text-base"
      />
    );
  }

  if (question.type === "essay") {
    return (
      <Textarea
        aria-label="Sua resposta"
        value={answer?.text ?? ""}
        onChange={(e) => onText(e.target.value, TEXT_DEBOUNCE_MS)}
        maxLength={10000}
        placeholder="Escreva sua resposta"
        className="min-h-48 text-base"
      />
    );
  }

  const multiple = question.type === "multiple_choice";
  const trueFalse = question.type === "true_false";

  return (
    <ul
      className={cn("grid gap-2.5", trueFalse && "grid-cols-2")}
      role={multiple ? "group" : "radiogroup"}
    >
      {question.options.map((option, i) => {
        const checked = selected.includes(option.id);
        return (
          <li key={option.id}>
            <button
              type="button"
              role={multiple ? "checkbox" : "radio"}
              aria-checked={checked}
              onClick={() => onChoose(option.id)}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-md border-[1.5px] bg-card px-3 py-3 text-left text-base transition-[border-color,box-shadow] outline-none focus-visible:ring-4 focus-visible:ring-ring",
                trueFalse && "justify-center font-semibold",
                checked
                  ? "border-foreground shadow-[3px_3px_0_var(--mark)]"
                  : "border-border active:border-foreground",
              )}
            >
              {trueFalse ? null : (
                <span
                  aria-hidden
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center border-[1.5px] border-foreground font-mono text-sm font-medium",
                    multiple ? "rounded-sm" : "rounded-full",
                    checked && "bg-foreground text-background",
                  )}
                >
                  {checked && multiple ? (
                    <Check className="size-4" strokeWidth={3} />
                  ) : (
                    optionLetter(i)
                  )}
                </span>
              )}
              <span className="min-w-0 break-words">{option.body}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Review({
  questions,
  answers,
  answeredCount,
  onOpen,
  confirming,
  setConfirming,
  submitting,
  submitError,
  onSubmit,
}: {
  questions: StudentQuestion[];
  answers: Record<string, SavedAnswer>;
  answeredCount: number;
  onOpen: (index: number) => void;
  confirming: boolean;
  setConfirming: (value: boolean) => void;
  submitting: boolean;
  submitError?: string;
  onSubmit: () => void;
}) {
  const blank = questions.length - answeredCount;

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-bold">
          <span className="hl">Revise antes de enviar</span>
        </h1>
        <p className="text-muted-foreground">
          {blank === 0
            ? "Você respondeu todas as questões."
            : `${pluralize(blank, "questão está", "questões estão")} em branco. Toque para voltar a ela.`}
        </p>
      </div>

      <ol className="grid grid-cols-5 gap-2">
        {questions.map((q, i) => {
          const done = isAnswered(q, answers[q.id]);
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => onOpen(i)}
                aria-label={`Questão ${i + 1}${done ? ", respondida" : ", em branco"}`}
                className={cn(
                  "flex h-12 w-full items-center justify-center rounded-md border-[1.5px] font-mono text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring",
                  done
                    ? "border-foreground bg-foreground text-background"
                    : "border-dashed border-pen bg-card text-pen",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </button>
            </li>
          );
        })}
      </ol>

      <FormMessage type="error" message={submitError} />

      {confirming ? (
        <div className="grid gap-3 rounded-md border-[1.5px] border-foreground bg-card p-4">
          <p className="font-medium">
            Depois de enviar, você não poderá mudar as respostas. Enviar agora?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12"
              disabled={submitting}
              onClick={() => setConfirming(false)}
            >
              Voltar
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-12"
              disabled={submitting}
              onClick={onSubmit}
            >
              {submitting ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
              Sim, enviar
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          <Button type="button" size="lg" className="h-12" onClick={() => setConfirming(true)}>
            Enviar prova
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="h-12"
            onClick={() => onOpen(0)}
          >
            Voltar às questões
          </Button>
        </div>
      )}
    </div>
  );
}
