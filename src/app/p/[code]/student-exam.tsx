"use client";

import { Clock, Hand, LoaderCircle, Lock, MailCheck, WifiOff } from "lucide-react";
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand";
import { FormMessage } from "@/components/form/form-message";
import { LocalDateTime } from "@/components/local-date-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pluralize } from "@/lib/classes/messages";
import {
  getAttempt,
  startAttempt,
  type AttemptResult,
  type AttemptState,
  type ExamEntry,
} from "@/lib/student/api";
import { CONNECTION_ERROR, entryErrorMessage } from "@/lib/student/messages";
import { ExamTaker, type InProgressAttempt } from "./exam-taker";
import { ResultView } from "./result-view";

type OpenEntry = Extract<ExamEntry, { title: string }>;

type Phase =
  | { kind: "loading" }
  | { kind: "entry"; error?: string }
  | { kind: "taking"; token: string; attempt: InProgressAttempt }
  | { kind: "result"; result: AttemptResult }
  | { kind: "interrupted" }
  | { kind: "already" }
  | { kind: "offline"; token: string };

/** Token da aplicação guardado só nesta aba (fechar a aba encerra o acesso — RN-18). */
const tokenKey = (code: string) => `prova:${code}:token`;

function readToken(code: string): string | null {
  try {
    return sessionStorage.getItem(tokenKey(code));
  } catch {
    return null;
  }
}

function writeToken(code: string, token: string | null) {
  try {
    if (token) sessionStorage.setItem(tokenKey(code), token);
    else sessionStorage.removeItem(tokenKey(code));
  } catch {
    // Armazenamento indisponível (ex.: navegação privada): a prova segue sem retomada.
  }
}

export function StudentExam({ code, entry }: { code: string; entry: ExamEntry }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const applyState = useCallback(
    (state: AttemptState, token: string) => {
      if ("error" in state) {
        if (state.error === "connection") {
          setPhase({ kind: "offline", token });
          return;
        }
        writeToken(code, null);
        setPhase({ kind: "entry" });
        return;
      }
      if (state.status === "in_progress") {
        writeToken(code, token);
        setPhase({ kind: "taking", token, attempt: state });
        return;
      }
      writeToken(code, null);
      if (state.status === "interrupted") setPhase({ kind: "interrupted" });
      else setPhase({ kind: "result", result: state.result });
    },
    [code],
  );

  const loadAttempt = useCallback(
    async (token: string) => applyState(await getAttempt(token), token),
    [applyState],
  );

  // Ao abrir (ou recarregar) a página: retoma a aplicação desta aba, se houver.
  useEffect(() => {
    const token = readToken(code);
    const request: Promise<AttemptState | null> = token ? getAttempt(token) : Promise.resolve(null);
    void request.then((state) => {
      if (state && token) applyState(state, token);
      else setPhase({ kind: "entry" });
    });
  }, [code, applyState]);

  async function enter(form: { name: string; registration: string; accessCode: string }) {
    const response = await startAttempt({ code, ...form, resumeToken: readToken(code) });
    if ("error" in response) {
      if (response.error === "interrupted") setPhase({ kind: "interrupted" });
      else if (response.error === "already_submitted") setPhase({ kind: "already" });
      else setPhase({ kind: "entry", error: entryErrorMessage(response.error) });
      return;
    }
    writeToken(code, response.token);
    await loadAttempt(response.token);
  }

  if ("error" in entry) {
    return (
      <Shell>
        <Notice icon={<Lock />} title="Prova não encontrada">
          {entry.error === "connection"
            ? CONNECTION_ERROR
            : "Confira se o link está completo, igual ao que o professor passou."}
        </Notice>
      </Shell>
    );
  }

  switch (phase.kind) {
    case "loading":
      return (
        <Shell entry={entry}>
          <div className="flex justify-center py-16" aria-label="Carregando">
            <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-hidden />
          </div>
        </Shell>
      );
    case "taking":
      return (
        <ExamTaker
          code={code}
          token={phase.token}
          attempt={phase.attempt}
          onFinished={(result) => {
            writeToken(code, null);
            setPhase({ kind: "result", result });
          }}
          onInterrupted={() => {
            writeToken(code, null);
            setPhase({ kind: "interrupted" });
          }}
        />
      );
    case "result":
      return (
        <Shell entry={entry}>
          <ResultView result={phase.result} />
        </Shell>
      );
    case "interrupted":
      return (
        <Shell entry={entry}>
          <Notice icon={<Hand />} title="Sua prova foi interrompida" tone="pen">
            A prova foi aberta em outro aparelho ou navegador. Para continuar,{" "}
            <strong>chame o professor</strong>. As respostas que você já marcou estão guardadas.
          </Notice>
        </Shell>
      );
    case "already":
      return (
        <Shell entry={entry}>
          <Notice icon={<MailCheck />} title="Você já enviou esta prova">
            Cada aluno faz a prova uma vez. Se precisar refazer, fale com o professor.
          </Notice>
        </Shell>
      );
    case "offline":
      return (
        <Shell entry={entry}>
          <Notice icon={<WifiOff />} title="Sem conexão">
            Não foi possível carregar sua prova. Verifique a internet do celular.
            <div className="mt-5">
              <Button type="button" size="lg" onClick={() => void loadAttempt(phase.token)}>
                Tentar de novo
              </Button>
            </div>
          </Notice>
        </Shell>
      );
    case "entry":
      return (
        <Shell entry={entry}>
          <EntryScreen entry={entry} error={phase.error} onEnter={enter} />
        </Shell>
      );
  }
}

function Shell({ entry, children }: { entry?: OpenEntry; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-5 pb-10">
      <header className="mb-8 flex items-center gap-3">
        <BrandMark />
        {entry ? (
          <span className="min-w-0 truncate text-sm text-muted-foreground">{entry.class_name}</span>
        ) : null}
      </header>
      {children}
    </div>
  );
}

function Notice({
  icon,
  title,
  children,
  tone = "ink",
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  tone?: "ink" | "pen";
}) {
  return (
    <div className="bg-graph grid justify-items-center gap-3 rounded-md border-[1.5px] border-foreground px-6 py-10 text-center">
      <span
        className={
          tone === "pen"
            ? "flex size-12 items-center justify-center rounded-md border-2 border-pen bg-card text-pen [&_svg]:size-6"
            : "flex size-12 items-center justify-center rounded-md border-2 border-foreground bg-card [&_svg]:size-6"
        }
        aria-hidden
      >
        {icon}
      </span>
      <h1 className="text-xl font-bold">{title}</h1>
      <div className="max-w-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function EntryScreen({
  entry,
  error,
  onEnter,
}: {
  entry: OpenEntry;
  error?: string;
  onEnter: (form: { name: string; registration: string; accessCode: string }) => Promise<void>;
}) {
  const ids = useId();
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string>();

  if (entry.state === "scheduled") {
    return (
      <Notice icon={<Clock />} title={entry.title}>
        A prova abre em <LocalDateTime iso={entry.opens_at} />. Recarregue a página no horário.
      </Notice>
    );
  }
  if (entry.state === "closed") {
    return (
      <Notice icon={<Lock />} title={entry.title}>
        Esta prova já foi encerrada.
      </Notice>
    );
  }

  async function submit(form: FormData) {
    const name = String(form.get("name") ?? "").trim();
    const registration = String(form.get("registration") ?? "").trim();
    const accessCode = String(form.get("accessCode") ?? "").trim();
    if (!name || !registration || (entry.requires_access_code && !accessCode)) {
      setFieldError("Preencha todos os campos para começar.");
      return;
    }
    setFieldError(undefined);
    setPending(true);
    try {
      await onEnter({ name, registration, accessCode });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <h1 className="text-3xl leading-tight font-bold tracking-tight">
          <span className="hl">{entry.title}</span>
        </h1>
        <ul className="flex flex-wrap gap-2 font-mono text-xs">
          <li className="rounded-sm border-[1.5px] border-border bg-card px-2 py-1">
            {pluralize(entry.question_count, "questão", "questões")}
          </li>
          <li className="rounded-sm border-[1.5px] border-border bg-card px-2 py-1">
            {entry.time_limit_minutes
              ? `${entry.time_limit_minutes} minutos`
              : "Sem limite de tempo"}
          </li>
          <li className="rounded-sm border-[1.5px] border-border bg-card px-2 py-1">
            Fecha <LocalDateTime iso={entry.closes_at} />
          </li>
        </ul>
        {entry.instructions ? (
          <p className="rounded-md border-[1.5px] border-dashed border-border bg-card px-4 py-3 whitespace-pre-line">
            {entry.instructions}
          </p>
        ) : null}
      </div>

      <form
        className="grid gap-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit(new FormData(event.currentTarget));
        }}
      >
        <FormMessage type="error" message={error ?? fieldError} />
        <div className="grid gap-2">
          <Label htmlFor={`${ids}-name`}>Seu nome</Label>
          <Input id={`${ids}-name`} name="name" autoComplete="name" className="h-12 text-base" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${ids}-registration`}>Matrícula</Label>
          <Input
            id={`${ids}-registration`}
            name="registration"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-12 font-mono text-base uppercase"
          />
        </div>
        {entry.requires_access_code ? (
          <div className="grid gap-2">
            <Label htmlFor={`${ids}-code`}>Código de acesso</Label>
            <Input
              id={`${ids}-code`}
              name="accessCode"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              placeholder="0000"
              className="h-12 w-32 text-center font-mono text-xl tracking-[0.3em]"
            />
            <p className="text-xs text-muted-foreground">O professor mostra o código na sala.</p>
          </div>
        ) : null}
        <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          Começar prova
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Depois de começar, não feche esta página até enviar a prova.
        </p>
        <p className="text-center text-xs text-muted-foreground">
          Seu nome, matrícula e respostas são usados só pela escola para esta avaliação.{" "}
          <a href="/privacidade" target="_blank" className="underline">
            Privacidade
          </a>
        </p>
      </form>
    </div>
  );
}
