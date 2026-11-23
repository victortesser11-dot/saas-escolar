import { ArrowRight, Check, Clock, X } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LocalDateTime } from "@/components/local-date-time";
import { PageHeader } from "@/components/page-header";
import { ScoreBadge } from "@/components/results/indicators";
import { buttonVariants } from "@/components/ui/button";
import { formatPoints } from "@/lib/questions/points";
import { questionTypeInfo } from "@/lib/questions/types";
import { getAttemptDetail, type AttemptAnswer } from "@/lib/results/queries";
import { cn } from "@/lib/utils";
import { GradeForm } from "./grade-form";

type Props = PageProps<"/painel/provas/[id]/turmas/[assignmentId]/alunos/[attemptId]">;

const EVENT_LABEL: Record<string, string> = {
  started: "Começou a prova",
  submitted: "Enviou a prova",
  expired: "Prova encerrada pelo tempo",
  interrupted: "Prova interrompida (acesso de outro aparelho)",
  blocked_access: "Tentou entrar novamente",
  resumed: "Retomou com liberação do professor",
  release_granted: "Professor liberou",
  graded: "Correção do professor",
  entry_failed: "Tentativa de entrada recusada",
};

export default function AttemptPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<Props, "params">) {
  const { id, assignmentId, attemptId } = await params;
  const { attempt, answers, events, nextPending } = await getAttemptDetail(attemptId);
  if (attempt.assignmentId !== assignmentId) notFound();

  const back = `/painel/provas/${id}/turmas/${assignmentId}`;
  const finalized =
    attempt.status === "submitted" ||
    attempt.status === "expired" ||
    attempt.status === "superseded";
  const pendingCount = answers.filter((a) => a.needsReview).length;

  return (
    <div className="grid grid-cols-1 gap-8">
      <title>{`${attempt.studentName} · Respostas · Avaliações Escolares`}</title>
      <PageHeader
        back={{ href: back, label: "Voltar à turma" }}
        eyebrow={`Nº ${attempt.registrationCode}${attempt.attemptNumber > 1 ? ` · tentativa ${attempt.attemptNumber}` : ""}`}
        title={attempt.studentName}
      />

      <div className="bg-graph flex flex-wrap items-center justify-between gap-4 rounded-md border-[1.5px] border-foreground p-4">
        <div className="grid gap-1">
          <span className="label-mono text-muted-foreground">Nota</span>
          <span className="text-lg">
            {finalized ? (
              <ScoreBadge
                percent={attempt.percent}
                score={attempt.score}
                maxScore={attempt.maxScore}
                partial={attempt.partial}
              />
            ) : (
              <span className="text-muted-foreground">Prova ainda não enviada</span>
            )}
          </span>
        </div>
        {pendingCount > 0 ? (
          <span className="text-sm text-pen">
            {pendingCount === 1
              ? "1 questão para corrigir"
              : `${pendingCount} questões para corrigir`}
          </span>
        ) : finalized ? (
          <span className="text-sm text-ok">Correção concluída</span>
        ) : null}
        {nextPending ? (
          <Link
            href={`${back}/alunos/${nextPending.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Próximo a corrigir: {nextPending.name.split(" ")[0]}
            <ArrowRight aria-hidden />
          </Link>
        ) : null}
      </div>

      <ol className="grid grid-cols-1 gap-4">
        {answers.map((answer) => (
          <AnswerCard key={answer.attemptQuestionId} answer={answer} canGrade={finalized} />
        ))}
      </ol>

      {events.length > 0 ? (
        <section aria-labelledby="historico" className="grid grid-cols-1 gap-3">
          <h2 id="historico" className="text-lg font-semibold">
            Histórico
          </h2>
          <ol className="grid gap-1.5 border-l-[1.5px] border-dashed border-border pl-4 text-sm">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap gap-x-3">
                <span className="font-mono text-xs text-muted-foreground">
                  <LocalDateTime iso={event.created_at} />
                </span>
                <span>{EVENT_LABEL[event.type] ?? event.type}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function AnswerCard({ answer, canGrade }: { answer: AttemptAnswer; canGrade: boolean }) {
  const info = questionTypeInfo(answer.type);
  const label = `questão ${answer.position}`;
  const state = answer.needsReview
    ? "review"
    : answer.isCorrect === true
      ? "right"
      : answer.isCorrect === false
        ? "wrong"
        : answer.pointsAwarded !== null
          ? "partial"
          : "none";

  return (
    <li
      className={cn(
        "grid gap-4 rounded-md border-[1.5px] bg-card p-4",
        state === "review" ? "border-foreground shadow-[3px_3px_0_var(--mark)]" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-sm text-muted-foreground">
            {String(answer.position).padStart(2, "0")}
          </span>
          <span className="label-mono">{info.short}</span>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 font-mono text-sm",
            state === "right" && "text-ok",
            state === "wrong" && "text-pen",
            state === "partial" && "text-warn",
            (state === "review" || state === "none") && "text-muted-foreground",
          )}
        >
          {state === "right" ? <Check className="size-4" aria-hidden /> : null}
          {state === "wrong" ? <X className="size-4" aria-hidden /> : null}
          {state === "review" ? <Clock className="size-4" aria-hidden /> : null}
          {state === "review" || state === "none"
            ? `${state === "review" ? "para corrigir · " : ""}vale ${formatPoints(answer.points)}`
            : `${formatPoints(answer.pointsAwarded ?? 0)}/${formatPoints(answer.points)}`}
        </span>
      </div>

      <p className="leading-relaxed break-words whitespace-pre-line">{answer.stem}</p>

      {answer.options.length > 0 ? (
        <ul className="grid gap-1.5 text-sm">
          {answer.options.map((option) => (
            <li
              key={option.id}
              className={cn(
                "flex items-start gap-2 rounded-sm px-2 py-1.5",
                option.chosen && "bg-secondary",
              )}
            >
              <span className="w-28 shrink-0 font-mono text-xs">
                {option.chosen ? <span className="font-medium">marcou</span> : null}
                {option.correct ? (
                  <span className="text-ok">{option.chosen ? " · " : ""}correta</span>
                ) : null}
              </span>
              <span className="break-words">{option.body}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-2 text-sm">
          <div className="grid gap-1">
            <span className="label-mono text-muted-foreground">Resposta do aluno</span>
            <p
              className={cn(
                "rounded-sm bg-secondary px-3 py-2 break-words whitespace-pre-line",
                !answer.textAnswer?.trim() && "text-muted-foreground",
              )}
            >
              {answer.textAnswer?.trim() || "Em branco"}
            </p>
          </div>
          {answer.accepted.length > 0 ? (
            <p className="text-muted-foreground">
              Respostas aceitas: <span className="text-ok">{answer.accepted.join("; ")}</span>
            </p>
          ) : null}
        </div>
      )}

      {answer.explanation ? (
        <p className="border-l-[3px] border-mark pl-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {answer.type === "essay" ? "Resposta esperada: " : "Resolução: "}
          </span>
          {answer.explanation}
        </p>
      ) : null}

      {canGrade && answer.answerId ? (
        <div className="border-t border-dashed border-border pt-3">
          <GradeForm
            answerId={answer.answerId}
            maxPoints={answer.points}
            current={answer.pointsAwarded}
            pendingReview={answer.needsReview}
            questionLabel={label}
          />
        </div>
      ) : null}
    </li>
  );
}
