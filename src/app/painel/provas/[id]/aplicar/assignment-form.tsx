"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useId, useState, useSyncExternalStore, useTransition } from "react";
import { FormMessage } from "@/components/form/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AssignmentInput } from "../../actions";

type ClassOption = { id: string; label: string; empty: boolean; selfEnroll: boolean };
type Action = (
  input: AssignmentInput,
) => Promise<{ status: "error"; message?: string; errors: Record<string, string> }>;

const subscribe = () => () => {};

/** "2026-11-20T08:00" no fuso do navegador (formato do campo datetime-local). */
function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * O horário padrão depende do relógio e do fuso do professor, por isso o formulário
 * só é montado no navegador.
 */
export function AssignmentForm(props: {
  examId: string;
  action: Action;
  classes: ClassOption[];
  timeLimitMinutes: number | null;
}) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!mounted) return <div className="h-96 animate-pulse rounded-md bg-muted" />;
  return <AssignmentFormBody {...props} />;
}

function AssignmentFormBody({
  examId,
  action,
  classes,
  timeLimitMinutes,
}: {
  examId: string;
  action: Action;
  classes: ClassOption[];
  timeLimitMinutes: number | null;
}) {
  const ids = useId();
  const [classId, setClassId] = useState(classes.length === 1 ? classes[0].id : "");
  const [opensAt, setOpensAt] = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return toLocalInput(now);
  });
  const [closesAt, setClosesAt] = useState(() => {
    // Padrão: aberta pelo tempo da prova + folga, com mínimo de 2 horas.
    const minutes = Math.max(120, (timeLimitMinutes ?? 0) + 30);
    const end = new Date(Date.now() + minutes * 60_000);
    end.setSeconds(0, 0);
    return toLocalInput(end);
  });
  const [requireAccessCode, setRequireAccessCode] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const selected = classes.find((c) => c.id === classId);

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
        classId,
        opensAt: opens.toISOString(),
        closesAt: closes.toISOString(),
        requireAccessCode,
      });
      setErrors(result.errors);
      setFormError(result.message);
    });
  }

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
        <Label htmlFor={`${ids}-class`}>Turma</Label>
        <select
          id={`${ids}-class`}
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          aria-invalid={errors.classId ? true : undefined}
          className="h-10 rounded-md border-[1.5px] border-input bg-card px-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-ring aria-invalid:border-destructive"
        >
          <option value="">Escolha a turma</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        {errors.classId ? <p className="text-xs text-destructive">{errors.classId}</p> : null}
        {selected?.empty && selected.selfEnroll ? (
          <p className="text-xs text-muted-foreground">
            A turma ainda não tem lista de alunos, e tudo bem: cada aluno entra com nome e número e
            já fica cadastrado na turma. Recomendamos exigir o código de acesso, para só entrar quem
            está na sala.
          </p>
        ) : null}
        {selected?.empty && !selected.selfEnroll ? (
          <p className="text-xs text-pen">
            Esta turma está com a lista fechada e ainda não tem alunos: ninguém conseguirá entrar na
            prova.{" "}
            <Link href={`/painel/turmas/${selected.id}`} className="underline underline-offset-2">
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
            onChange={(e) => setClosesAt(e.target.value)}
            className="font-mono"
            aria-invalid={errors.closesAt ? true : undefined}
          />
          {errors.closesAt ? <p className="text-xs text-destructive">{errors.closesAt}</p> : null}
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        {timeLimitMinutes
          ? `Cada aluno tem ${timeLimitMinutes} minutos a partir do momento em que começa, sem passar do fechamento.`
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
        <Button type="submit" size="lg" disabled={pending || !classId}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          Aplicar e gerar link
        </Button>
        <Link
          href={`/painel/provas/${examId}`}
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
