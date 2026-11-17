"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPoints } from "@/lib/questions/points";
import { gradeAnswer } from "../../../../../../resultados/actions";

/** Campo de correção: pontos de 0 até o valor da questão, com atalhos. */
export function GradeForm({
  answerId,
  maxPoints,
  current,
  pendingReview,
  questionLabel,
}: {
  answerId: string;
  maxPoints: number;
  current: number | null;
  pendingReview: boolean;
  questionLabel: string;
}) {
  const [value, setValue] = useState(current === null ? "" : formatPoints(current));
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  function save(points: string) {
    setValue(points);
    setMessage(undefined);
    startTransition(async () => {
      const result = await gradeAnswer(answerId, points, maxPoints);
      setMessage(
        result.ok
          ? { ok: true, text: "Correção salva." }
          : { ok: false, text: result.message ?? "Erro." },
      );
    });
  }

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        save(value);
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          {pendingReview ? "Nota desta questão" : "Revisar nota"}
          <Input
            aria-label={`Pontos da ${questionLabel}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            className="h-9 w-20 font-mono"
          />
          <span className="font-normal text-muted-foreground">de {formatPoints(maxPoints)}</span>
        </label>
        <Button type="submit" size="sm" disabled={pending || value.trim() === ""}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          Salvar
        </Button>
        <span className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => save("0")}
          >
            Zero
          </Button>
          {maxPoints > 0.5 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => save(formatPoints(Math.round((maxPoints / 2) * 100) / 100))}
            >
              Metade
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => save(formatPoints(maxPoints))}
          >
            Inteira
          </Button>
        </span>
      </div>
      {message ? (
        <p
          className={message.ok ? "text-xs text-ok" : "text-xs text-destructive"}
          aria-live="polite"
        >
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
