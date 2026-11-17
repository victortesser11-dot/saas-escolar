"use client";

import { LoaderCircle } from "lucide-react";
import { useId, useState, useTransition, type ReactNode } from "react";
import { FormMessage } from "@/components/form/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateExamRules, type RulesInput } from "../actions";

/** Regras da prova (só em rascunho): sorteio, tempo, resultado e embaralhamento. */
export function RulesForm({
  examId,
  questionCount,
  initial,
}: {
  examId: string;
  questionCount: number;
  initial: RulesInput;
}) {
  const [rules, setRules] = useState<RulesInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string }>();
  const [pending, startTransition] = useTransition();
  const ids = useId();

  const set = <K extends keyof RulesInput>(key: K, value: RulesInput[K]) => {
    setRules((current) => ({ ...current, [key]: value }));
    setMessage(undefined);
  };

  function save() {
    startTransition(async () => {
      const result = await updateExamRules(examId, rules);
      setErrors(result.errors ?? {});
      setMessage(
        result.message
          ? { type: result.status === "success" ? "success" : "error", text: result.message }
          : undefined,
      );
    });
  }

  return (
    <form
      className="grid gap-6 rounded-md border-[1.5px] border-border bg-card p-4 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      noValidate
    >
      <Fieldset legend="Questões por aluno">
        <Choice
          name={`${ids}-draw`}
          checked={rules.drawMode === "all"}
          onChange={() => set("drawMode", "all")}
        >
          Todas as questões da prova ({questionCount})
        </Choice>
        <Choice
          name={`${ids}-draw`}
          checked={rules.drawMode === "some"}
          onChange={() => set("drawMode", "some")}
        >
          <span className="flex flex-wrap items-center gap-2">
            Sortear
            <Input
              aria-label="Quantas questões cada aluno recebe"
              value={rules.questionsPerAttempt}
              onChange={(e) => {
                set("questionsPerAttempt", e.target.value);
                set("drawMode", "some");
              }}
              inputMode="numeric"
              className="h-8 w-16 font-mono"
              aria-invalid={errors.questionsPerAttempt ? true : undefined}
            />
            questões para cada aluno
          </span>
        </Choice>
        <Hint>
          Sorteando parte das questões, cada aluno recebe uma prova diferente. Nesse caso todas
          precisam ter o mesmo valor.
        </Hint>
        <FieldError message={errors.questionsPerAttempt} />
      </Fieldset>

      <Fieldset legend="Tempo">
        <Choice
          name={`${ids}-time`}
          checked={rules.timeMode === "none"}
          onChange={() => set("timeMode", "none")}
        >
          Sem limite (vale só o período de abertura)
        </Choice>
        <Choice
          name={`${ids}-time`}
          checked={rules.timeMode === "limit"}
          onChange={() => set("timeMode", "limit")}
        >
          <span className="flex flex-wrap items-center gap-2">
            Limite de
            <Input
              aria-label="Tempo máximo em minutos"
              value={rules.timeLimitMinutes}
              onChange={(e) => {
                set("timeLimitMinutes", e.target.value);
                set("timeMode", "limit");
              }}
              inputMode="numeric"
              className="h-8 w-16 font-mono"
              aria-invalid={errors.timeLimitMinutes ? true : undefined}
            />
            minutos, contados a partir do início de cada aluno
          </span>
        </Choice>
        <FieldError message={errors.timeLimitMinutes} />
      </Fieldset>

      <Fieldset legend="Depois de enviar, o aluno vê">
        <Choice
          name={`${ids}-result`}
          checked={rules.resultVisibility === "score_only"}
          onChange={() => set("resultVisibility", "score_only")}
        >
          Só a nota
        </Choice>
        <Choice
          name={`${ids}-result`}
          checked={rules.resultVisibility === "score_and_key"}
          onChange={() => set("resultVisibility", "score_and_key")}
        >
          A nota e as respostas corretas
        </Choice>
        <Hint>Questões dissertativas ficam como “aguardando correção” até você corrigir.</Hint>
      </Fieldset>

      <Fieldset legend="Embaralhar para cada aluno">
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={rules.shuffleQuestions}
            onChange={(e) => set("shuffleQuestions", e.target.checked)}
            className="size-4 accent-foreground"
          />
          Ordem das questões
        </label>
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={rules.shuffleOptions}
            onChange={(e) => set("shuffleOptions", e.target.checked)}
            className="size-4 accent-foreground"
          />
          Ordem das alternativas
        </label>
      </Fieldset>

      {message ? <FormMessage type={message.type} message={message.text} /> : null}

      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          Salvar regras
        </Button>
      </div>
    </form>
  );
}

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      {children}
    </fieldset>
  );
}

function Choice({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-h-8 items-center gap-2.5 text-sm">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 accent-foreground"
      />
      {children}
    </label>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}
