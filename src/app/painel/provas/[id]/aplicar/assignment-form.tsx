"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useId, useState, useSyncExternalStore, useTransition } from "react";
import { FormMessage } from "@/components/form/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApplyInput } from "../../actions";

/**
 * Formulário de aplicação, usado nos dois sentidos:
 * - a partir da prova: escolhe a TURMA (choose = "class");
 * - a partir da turma: escolhe a PROVA (choose = "exam").
 */
export type ApplyOption = {
  id: string;
  label: string;
  /** Turma sem alunos (só em choose = "class"). */
  empty?: boolean;
  selfEnroll?: boolean;
  /** Tempo da prova (só em choose = "exam"). */
  timeLimitMinutes?: number | null;
};

/** Turma já definida (choose = "exam"), para o aviso de turma sem alunos. */
export type FixedClass = { id: string; empty: boolean; selfEnroll: boolean };

type Action = (
  input: ApplyInput,
) => Promise<{ status: "error"; message?: string; errors: Record<string, string> }>;

type Props = {
  choose: "class" | "exam";
  options: ApplyOption[];
  action: Action;
  cancelHref: string;
  /** Tempo da prova quando ela já está definida (choose = "class"). */
  timeLimitMinutes?: number | null;
  fixedClass?: FixedClass;
};

const subscribe = () => () => {};

/** "2026-11-20T08:00" no fuso do navegador (formato do campo datetime-local). */
function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Padrão: aberta pelo tempo da prova + folga, com mínimo de 2 horas. */
function defaultClosesAt(timeLimitMinutes: number | null | undefined) {
  const minutes = Math.max(120, (timeLimitMinutes ?? 0) + 30);
  const end = new Date(Date.now() + minutes * 60_000);
  end.setSeconds(0, 0);
  return toLocalInput(end);
}

/**
 * O horário padrão depende do relógio e do fuso do professor, por isso o formulário
 * só é montado no navegador.
 */
export function AssignmentForm(props: Props) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!mounted) return <div className="h-96 animate-pulse rounded-md bg-muted" />;
  return <AssignmentFormBody {...props} />;
}

function AssignmentFormBody({
  choose,
  options,
  action,
  cancelHref,
  timeLimitMinutes,
  fixedClass,
}: Props) {
  const ids = useId();
  const [targetId, setTargetId] = useState(options.length === 1 ? options[0].id : "");
  const [opensAt, setOpensAt] = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return toLocalInput(now);
  });
  const selected = options.find((o) => o.id === targetId);
  const timeLimit = choose === "exam" ? selected?.timeLimitMinutes : timeLimitMinutes;
  const [closesAt, setClosesAt] = useState(() => defaultClosesAt(timeLimit));
  const [closesTouched, setClosesTouched] = useState(false);
  const [requireAccessCode, setRequireAccessCode] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  // Aviso de turma sem alunos: a turma escolhida, ou a turma fixa.
  const classInfo =
    choose === "class"
      ? selected && { id: selected.id, empty: !!selected.empty, selfEnroll: !!selected.selfEnroll }
      : fixedClass;

  function pick(id: string) {
    setTargetId(id);
    // Ao trocar de prova, o fechamento padrão acompanha o tempo dela (se não foi editado).
    if (choose === "exam" && !closesTouched) {
      setClosesAt(defaultClosesAt(options.find((o) => o.id === id)?.timeLimitMinutes));
    }
  }

  function submit() {
    setFormError(undefined);
    const opens = new Date(opensAt);
    const closes = new Date(closesAt);
    if (Number.isNaN(opens.getTime()) || Number.isNaN(closes.getTime())) {
      setErrors({ closesAt: "Informe a data e a hora de abertura e de fechamento." });
      return;
    }
    startTransition(async () => {
      const result = await action({
        targetId,
        opensAt: opens.toISOString(),
        closesAt: closes.toISOString(),
        requireAccessCode,
      });
      setErrors(result.errors);
      setFormError(result.message);
    });
  }

  const label = choose === "class" ? "Turma" : "Prova";
  const targetError = errors.targetId ?? errors.classId;

  return (
    <form
      className="grid gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor={`${ids}-target`}>{label}</Label>
        <select
          id={`${ids}-target`}
          value={targetId}
          onChange={(e) => pick(e.target.value)}
          aria-invalid={targetError ? true : undefined}
          className="h-10 rounded-md border-[1.5px] border-input bg-card px-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring aria-invalid:border-destructive"
        >
          <option value="">{choose === "class" ? "Escolha a turma" : "Escolha a prova"}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {targetError ? <p className="text-xs text-destructive">{targetError}</p> : null}
        {classInfo?.empty && classInfo.selfEnroll ? (
          <p className="text-xs text-muted-foreground">
            A turma ainda não tem lista de alunos, e tudo bem: cada aluno entra com nome e número e
            já fica cadastrado na turma. Recomendamos exigir o código de acesso, para só entrar quem
            está na sala.
          </p>
        ) : null}
        {classInfo?.empty && !classInfo.selfEnroll ? (
          <p className="text-xs text-pen">
            Esta turma está com a lista fechada e ainda não tem alunos: ninguém conseguirá entrar na
            prova.{" "}
            <Link href={`/painel/turmas/${classInfo.id}`} className="underline underline-offset-2">
              Cadastrar alunos ou abrir a lista
            </Link>
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${ids}-opens`}>Abre em</Label>
          <Input
            id={`${ids}-opens`}
            type="datetime-local"
            value={opensAt}
            onChange={(e) => setOpensAt(e.target.value)}
            className="font-mono"
            aria-invalid={errors.opensAt ? true : undefined}
          />
          {errors.opensAt ? <p className="text-xs text-destructive">{errors.opensAt}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${ids}-closes`}>Fecha em</Label>
          <Input
            id={`${ids}-closes`}
            type="datetime-local"
            value={closesAt}
            onChange={(e) => {
              setClosesAt(e.target.value);
              setClosesTouched(true);
            }}
            className="font-mono"
            aria-invalid={errors.closesAt ? true : undefined}
          />
          {errors.closesAt ? <p className="text-xs text-destructive">{errors.closesAt}</p> : null}
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        {choose === "exam" && !selected
          ? "O tempo de cada aluno segue as regras da prova escolhida."
          : timeLimit
            ? `Cada aluno tem ${timeLimit} minutos a partir do momento em que começa, sem passar do fechamento.`
            : "Sem limite de tempo: o aluno pode responder até o fechamento."}
      </p>

      <label className="flex items-start gap-3 rounded-md border-[1.5px] border-border bg-card p-4 text-sm has-checked:border-foreground">
        <input
          type="checkbox"
          checked={requireAccessCode}
          onChange={(e) => setRequireAccessCode(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-foreground"
        />
        <span className="grid gap-1">
          <span className="font-medium">Exigir código de acesso</span>
          <span className="text-muted-foreground">
            Geramos um código de 4 números para você mostrar no quadro. Assim só quem está na sala
            consegue entrar, mesmo que o link circule.
          </span>
        </span>
      </label>

      <FormMessage type="error" message={formError} />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={pending || !targetId}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          Aplicar e gerar link
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: "outline", size: "lg" })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
