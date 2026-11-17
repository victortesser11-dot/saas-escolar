"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { finalizeAttemptByTeacher, grantRelease } from "../../../../resultados/actions";

/** Ações do professor sobre um aluno: liberar retomada/nova tentativa ou encerrar. */
export function StudentActions({
  assignmentId,
  studentId,
  attemptId,
  situation,
  pendingRelease,
  closed,
}: {
  assignmentId: string;
  studentId: string;
  attemptId: string | null;
  situation: string;
  pendingRelease: "resume" | "new_attempt" | null;
  closed: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "resume" | "new" | "finalize">("idle");
  const [minutes, setMinutes] = useState("10");
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (pendingRelease) {
    return (
      <span className="text-xs text-muted-foreground">
        {pendingRelease === "resume" ? "Retomada liberada" : "Nova tentativa liberada"}: o aluno já
        pode entrar.
      </span>
    );
  }

  const canResume = situation === "interrupted" && !closed;
  const canNew =
    !closed && ["interrupted", "pending_review", "graded", "expired"].includes(situation);
  const canFinalize =
    attemptId !== null && (situation === "interrupted" || situation === "in_progress");

  if (!canResume && !canNew && !canFinalize) return null;

  function run(action: () => Promise<{ ok: boolean; message?: string } | void>) {
    setMessage(undefined);
    startTransition(async () => {
      const result = await action();
      if (result && !result.ok) setMessage(result.message);
      else setMode("idle");
    });
  }

  if (mode === "resume") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm">
          Minutos extras
          <Input
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            inputMode="numeric"
            className="h-8 w-14 font-mono"
          />
        </label>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => grantRelease(assignmentId, studentId, "resume", Number(minutes) || 0))
          }
        >
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          Liberar retomada
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setMode("idle")}>
          Cancelar
        </Button>
        {message ? <p className="w-full text-xs text-destructive">{message}</p> : null}
      </div>
    );
  }

  if (mode === "new" || mode === "finalize") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">
          {mode === "new"
            ? "O aluno fará outra prova sorteada; a anterior fica no histórico."
            : "Encerrar e corrigir com as respostas já salvas?"}
        </span>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          autoFocus
          onClick={() =>
            run(() =>
              mode === "new"
                ? grantRelease(assignmentId, studentId, "new_attempt", 0)
                : finalizeAttemptByTeacher(attemptId!),
            )
          }
        >
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          {mode === "new" ? "Liberar nova tentativa" : "Encerrar"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setMode("idle")}>
          Cancelar
        </Button>
        {message ? <p className="w-full text-xs text-destructive">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {canResume ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setMode("resume")}>
          Liberar retomada
        </Button>
      ) : null}
      {canNew ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => setMode("new")}>
          Nova tentativa
        </Button>
      ) : null}
      {canFinalize ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => setMode("finalize")}>
          Encerrar
        </Button>
      ) : null}
    </div>
  );
}
