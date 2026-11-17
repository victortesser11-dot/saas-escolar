"use client";

import { ArrowDown, ArrowUp, Pencil, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPoints } from "@/lib/questions/points";
import { questionTypeInfo } from "@/lib/questions/types";
import { cn } from "@/lib/utils";
import { GradingTag } from "../../questoes/_components/question-editor";
import { moveExamQuestion, removeExamQuestion, setExamQuestionPoints } from "../actions";
import type { ExamQuestionItem } from "@/lib/exams/queries";

/** Linha da questão na prova: valor editável, ordem e remoção (só em rascunho). */
export function ExamQuestionRow({
  examId,
  item,
  index,
  editable,
  isFirst,
  isLast,
}: {
  examId: string;
  item: ExamQuestionItem;
  index: number;
  editable: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const info = questionTypeInfo(item.type);
  const [points, setPoints] = useState(formatPoints(item.points));
  const [error, setError] = useState<string>();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, startTransition] = useTransition();

  function savePoints() {
    if (points.trim() === formatPoints(item.points)) return;
    startTransition(async () => {
      const result = await setExamQuestionPoints(item.id, points);
      setError(result.ok ? undefined : result.message);
    });
  }

  return (
    <li className="grid gap-3 rounded-md border-[1.5px] border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 font-mono text-sm text-muted-foreground tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="grid min-w-0 flex-1 gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="label-mono">{info.short}</span>
            <GradingTag grading={info.grading} />
          </div>
          <p className="line-clamp-3 leading-relaxed break-words whitespace-pre-line">
            {item.stem}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {editable ? (
            <label className="flex items-center gap-1.5 text-sm">
              <span className="sr-only">Valor da questão {index + 1}</span>
              <Input
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                onBlur={savePoints}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    savePoints();
                  }
                }}
                inputMode="decimal"
                aria-invalid={error ? true : undefined}
                className={cn("h-8 w-16 text-right font-mono", pending && "opacity-60")}
              />
              <span className="text-muted-foreground">pts</span>
            </label>
          ) : (
            <span className="font-mono text-sm tabular-nums">{formatPoints(item.points)} pts</span>
          )}
        </div>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {editable ? (
        <div className="flex flex-wrap items-center justify-end gap-1 border-t border-dashed border-border pt-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Mover questão ${index + 1} para cima`}
            disabled={isFirst || pending}
            onClick={() => startTransition(() => moveExamQuestion(item.id, -1))}
          >
            <ArrowUp aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Mover questão ${index + 1} para baixo`}
            disabled={isLast || pending}
            onClick={() => startTransition(() => moveExamQuestion(item.id, 1))}
          >
            <ArrowDown aria-hidden />
          </Button>
          <Link
            href={`/painel/questoes/${item.questionId}?prova=${examId}`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <Pencil aria-hidden />
            Editar
          </Link>
          {confirmRemove ? (
            <>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pending}
                autoFocus
                className="border-pen bg-pen text-white hover:bg-pen/90"
                onClick={() => startTransition(() => removeExamQuestion(item.id))}
              >
                Tirar da prova
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmRemove(false)}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmRemove(true)}>
              <X aria-hidden />
              Remover
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}
