import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { LocalDateTime } from "@/components/local-date-time";
import { PageHeader } from "@/components/page-header";
import { AutoRefresh } from "@/components/results/auto-refresh";
import { DistributionChart, QuestionChart } from "@/components/results/charts";
import {
  BandLegend,
  KpiRow,
  KpiTile,
  ScoreBadge,
  SituationChip,
} from "@/components/results/indicators";
import { StatusChip } from "@/components/status-chip";
import { buttonVariants } from "@/components/ui/button";
import { pluralize } from "@/lib/classes/messages";
import { ASSIGNMENT_STATUS_LABEL, assignmentStatus } from "@/lib/exams/rules";
import { formatPoints } from "@/lib/questions/points";
import { questionTypeInfo } from "@/lib/questions/types";
import { getAssignmentReport } from "@/lib/results/queries";
import { histogram, SITUATION_ORDER, summarize } from "@/lib/results/stats";
import { StudentActions } from "./student-actions";

type Props = PageProps<"/painel/provas/[id]/turmas/[assignmentId]">;

export default function AssignmentReportPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<Props, "params">) {
  const { id, assignmentId } = await params;
  const { assignment, students, questions } = await getAssignmentReport(assignmentId);
  if (assignment.examId !== id) notFound();

  const status = assignmentStatus(assignment);
  const finished = students.filter((s) => s.percent !== null);
  const percents = finished.map((s) => s.percent as number);
  const summary = summarize(percents);
  const pending = students.filter((s) => s.situation === "pending_review");
  const attention = students.filter((s) => s.situation === "interrupted");
  // "Abaixo de 50%" só com notas finais: dissertativa ainda não corrigida conta zero por enquanto.
  const low = finished.filter((s) => !s.partial && (s.percent as number) < 50);
  const partialCount = finished.filter((s) => s.partial).length;
  const ordered = [...students].sort(
    (a, b) => SITUATION_ORDER.indexOf(a.situation) - SITUATION_ORDER.indexOf(b.situation),
  );
  const firstPending = pending.find((s) => s.attemptId);

  return (
    <div className="grid grid-cols-1 gap-10">
      <title>{`${assignment.examTitle} · ${assignment.className} · Avaliações Escolares`}</title>
      {status === "open" ? <AutoRefresh seconds={15} /> : null}

      <PageHeader
        back={{ href: `/painel/provas/${assignment.examId}`, label: assignment.examTitle }}
        eyebrow={assignment.examTitle}
        title={assignment.className}
        actions={
          <>
            {status !== "closed" ? <CopyButton path={`/p/${assignment.publicCode}`} /> : null}
            <Link
              href={`/painel/notas/${assignment.classId}`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Notas da turma
            </Link>
          </>
        }
      />

      <div className="-mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <StatusChip tone={status}>{ASSIGNMENT_STATUS_LABEL[status]}</StatusChip>
        <span className="text-muted-foreground">
          <LocalDateTime iso={assignment.opensAt} /> até{" "}
          <LocalDateTime iso={assignment.closedAt ?? assignment.closesAt} />
        </span>
        {assignment.accessCode && status !== "closed" ? (
          <span className="font-mono">
            Código <strong className="tracking-[0.2em]">{assignment.accessCode}</strong>
          </span>
        ) : null}
        {status === "open" ? (
          <span className="text-xs text-muted-foreground">Atualiza a cada 15 segundos</span>
        ) : null}
      </div>

      {attention.length > 0 ? (
        <p className="rounded-md border-[1.5px] border-pen bg-pen/5 px-4 py-3 text-sm text-pen">
          <strong>
            {pluralize(
              attention.length,
              "aluno com prova interrompida",
              "alunos com prova interrompida",
            )}
          </strong>{" "}
          ({attention.map((s) => s.fullName.split(" ")[0]).join(", ")}). Veja abaixo e decida se
          libera a retomada.
        </p>
      ) : null}

      <section aria-labelledby="indicadores" className="grid grid-cols-1 gap-4">
        <h2 id="indicadores" className="sr-only">
          Indicadores
        </h2>
        <KpiRow>
          <KpiTile
            label="Participação"
            value={`${finished.length}/${students.length}`}
            detail={
              students.length > 0
                ? `${Math.round((finished.length / students.length) * 100)}% enviaram`
                : "Turma sem alunos"
            }
          />
          <KpiTile
            label="Média da turma"
            value={summary.mean === null ? "—" : `${formatPoints(summary.mean)}%`}
            detail={
              summary.median === null
                ? "Sem notas ainda"
                : `Mediana ${formatPoints(summary.median)}%${partialCount > 0 ? " · inclui parciais" : ""}`
            }
          />
          <KpiTile
            label="Abaixo de 50%"
            value={low.length}
            tone={low.length > 0 ? "alert" : "default"}
            detail={
              partialCount > 0
                ? `Entre as corrigidas; ${partialCount} aguardam correção`
                : low.length > 0
                  ? "Precisam de atenção"
                  : "Nenhum aluno"
            }
          />
          <KpiTile
            label="Para corrigir"
            value={pending.length}
            tone={pending.length > 0 ? "alert" : "default"}
            detail={
              firstPending ? (
                <Link
                  href={`/painel/provas/${assignment.examId}/turmas/${assignment.id}/alunos/${firstPending.attemptId}`}
                  className="underline decoration-mark decoration-[3px] underline-offset-2"
                >
                  Corrigir agora
                </Link>
              ) : (
                "Nada pendente"
              )
            }
          />
        </KpiRow>
        {summary.count > 0 ? (
          <p className="text-xs text-muted-foreground">
            Maior nota {formatPoints(summary.max!)}% · menor nota {formatPoints(summary.min!)}%.
            Notas parciais (com dissertativa por corrigir) entram nos indicadores com o valor atual.
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <section
          aria-labelledby="distribuicao"
          className="grid min-w-0 grid-cols-1 content-start gap-3"
        >
          <h2 id="distribuicao" className="text-lg font-semibold">
            Distribuição das notas
          </h2>
          {summary.count > 0 ? (
            <DistributionChart bins={histogram(percents)} total={summary.count} />
          ) : (
            <p className="text-sm text-muted-foreground">
              As notas aparecem aqui conforme os alunos enviam.
            </p>
          )}
        </section>

        <section
          aria-labelledby="por-questao"
          className="grid min-w-0 grid-cols-1 content-start gap-3"
        >
          <h2 id="por-questao" className="text-lg font-semibold">
            Acerto por questão
          </h2>
          {summary.count > 0 ? (
            <QuestionChart
              rows={questions.map((q) => ({
                key: q.examQuestionId,
                label: `Q${String(q.position).padStart(2, "0")}`,
                detail: q.stem,
                percent: q.percent,
                note:
                  q.pending > 0
                    ? `${q.pending} para corrigir`
                    : questionTypeInfo(q.type).grading === "manual"
                      ? "sem respostas"
                      : "sem dados",
              }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Mostra quais questões a turma mais errou, para revisar o conteúdo.
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="alunos-titulo" className="grid grid-cols-1 gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="alunos-titulo" className="text-lg font-semibold">
            Alunos
          </h2>
          <BandLegend />
        </div>
        {students.length === 0 ? (
          <EmptyState
            title="Turma sem alunos"
            description="Cadastre os alunos da turma para que eles consigam entrar na prova."
          />
        ) : (
          <div className="relative overflow-x-auto rounded-md border-[1.5px] border-border bg-card">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="border-b-[1.5px] border-foreground text-left">
                  <th
                    scope="col"
                    className="label-mono px-4 py-2.5 font-normal text-muted-foreground"
                  >
                    Aluno
                  </th>
                  <th
                    scope="col"
                    className="label-mono px-4 py-2.5 font-normal text-muted-foreground"
                  >
                    Situação
                  </th>
                  <th
                    scope="col"
                    className="label-mono px-4 py-2.5 font-normal text-muted-foreground"
                  >
                    Nota
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((s) => (
                  <tr
                    key={s.studentId}
                    className="border-b border-border align-middle last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.fullName}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {s.registrationCode}
                        {s.attemptCount > 1 ? ` · ${s.attemptCount} tentativas` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SituationChip situation={s.situation} />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge
                        percent={s.percent}
                        score={s.score}
                        maxScore={s.maxScore}
                        partial={s.partial}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <StudentActions
                          assignmentId={assignment.id}
                          studentId={s.studentId}
                          attemptId={s.attemptId}
                          situation={s.situation}
                          pendingRelease={s.pendingRelease}
                          closed={status === "closed"}
                        />
                        {s.attemptId ? (
                          <Link
                            href={`/painel/provas/${assignment.examId}/turmas/${assignment.id}/alunos/${s.attemptId}`}
                            className={buttonVariants({
                              variant: s.situation === "pending_review" ? "default" : "outline",
                              size: "sm",
                            })}
                          >
                            {s.situation === "pending_review" ? (
                              <>
                                <ClipboardCheck aria-hidden />
                                Corrigir
                              </>
                            ) : (
                              "Respostas"
                            )}
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
