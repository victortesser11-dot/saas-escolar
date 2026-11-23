import { BookOpen, Pencil, Plus, Send, Trash2, Undo2, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { FormMessage } from "@/components/form/form-message";
import { LocalDateTime } from "@/components/local-date-time";
import { PageHeader } from "@/components/page-header";
import { StatusChip } from "@/components/status-chip";
import { buttonVariants } from "@/components/ui/button";
import { pluralize } from "@/lib/classes/messages";
import { getExamDetail, type ExamDetail } from "@/lib/exams/queries";
import { ASSIGNMENT_STATUS_LABEL, assignmentStatus, summarizeExam } from "@/lib/exams/rules";
import { formatPoints } from "@/lib/questions/points";
import { closeAssignmentNow, deleteAssignment, deleteExam, unpublishExam } from "../actions";
import { ExamQuestionRow } from "./exam-question-row";
import { RulesForm } from "./rules-form";

type Props = PageProps<"/painel/provas/[id]">;

export default function ExamPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
      <ExamContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ExamContent({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const exam = await getExamDetail(id);
  const published = exam.status === "published";
  const summary = summarizeExam({
    questionsPerAttempt: exam.questionsPerAttempt,
    points: exam.questions.map((q) => q.points),
  });
  const now = new Date();

  return (
    <div className="grid gap-10">
      <title>{`${exam.title} · Avaliações Escolares`}</title>
      <PageHeader
        back={{ href: "/painel/provas", label: "Provas" }}
        eyebrow={[exam.subject?.name, published ? "Prova publicada" : "Rascunho"]
          .filter(Boolean)
          .join(" · ")}
        title={exam.title}
        actions={
          <>
            <Link
              href={`/painel/provas/${exam.id}/editar`}
              className={buttonVariants({ variant: "ghost" })}
            >
              <Pencil aria-hidden />
              Nome e disciplina
            </Link>
            {published ? (
              <Link href={`/painel/provas/${exam.id}/aplicar`} className={buttonVariants()}>
                <Send aria-hidden />
                Aplicar em turma
              </Link>
            ) : (
              <Link href={`/painel/provas/${exam.id}/publicar`} className={buttonVariants()}>
                Revisar e publicar
              </Link>
            )}
          </>
        }
      />

      {query.publicada ? (
        <FormMessage
          type="success"
          message="Prova publicada. Agora aplique em uma turma para gerar o link dos alunos."
        />
      ) : null}
      {query.aplicada ? (
        <FormMessage
          type="success"
          message="Prova aplicada. Copie o link da turma e envie aos alunos (ou mostre no quadro)."
        />
      ) : null}
      {query.erro === "despublicar" ? (
        <FormMessage
          type="error"
          message="A prova já foi aberta para uma turma e não pode voltar a rascunho."
        />
      ) : null}

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="grid min-w-0 gap-10">
          {published ? <AssignmentsSection exam={exam} now={now} /> : null}

          <section aria-labelledby="questoes-titulo" className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="questoes-titulo" className="text-lg font-semibold">
                Questões{" "}
                <span className="font-mono text-sm font-normal text-muted-foreground">
                  ({exam.questions.length})
                </span>
              </h2>
              {published ? (
                <span className="text-xs text-muted-foreground">
                  Cópia congelada na publicação. Edições no banco não alteram esta prova.
                </span>
              ) : null}
            </div>

            {exam.questions.length === 0 ? (
              <EmptyState
                title="Nenhuma questão ainda"
                description="Escreva as questões aqui mesmo. Elas também ficam guardadas no seu banco para usar em outras provas."
              >
                <AddQuestionButtons examId={exam.id} />
              </EmptyState>
            ) : (
              <>
                <ol className="grid gap-2">
                  {exam.questions.map((item, index) => (
                    <ExamQuestionRow
                      key={item.id}
                      examId={exam.id}
                      item={item}
                      index={index}
                      editable={!published}
                      isFirst={index === 0}
                      isLast={index === exam.questions.length - 1}
                    />
                  ))}
                </ol>
                {published ? null : (
                  <div className="flex flex-wrap gap-2">
                    <AddQuestionButtons examId={exam.id} />
                  </div>
                )}
              </>
            )}
          </section>

          {published ? null : (
            <section aria-labelledby="regras-titulo" className="grid gap-3">
              <h2 id="regras-titulo" className="text-lg font-semibold">
                Regras
              </h2>
              <RulesForm
                examId={exam.id}
                questionCount={exam.questions.length}
                initial={{
                  drawMode: exam.questionsPerAttempt === null ? "all" : "some",
                  questionsPerAttempt: exam.questionsPerAttempt
                    ? String(exam.questionsPerAttempt)
                    : "",
                  timeMode: exam.timeLimitMinutes === null ? "none" : "limit",
                  timeLimitMinutes: exam.timeLimitMinutes ? String(exam.timeLimitMinutes) : "",
                  resultVisibility: exam.resultVisibility,
                  shuffleQuestions: exam.shuffleQuestions,
                  shuffleOptions: exam.shuffleOptions,
                }}
              />
            </section>
          )}
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-6">
          <dl className="bg-graph grid gap-4 rounded-md border-[1.5px] border-foreground p-4">
            <SummaryItem label="Cada aluno recebe">
              {pluralize(summary.perAttempt, "questão", "questões")}
            </SummaryItem>
            <SummaryItem label="Nota máxima">
              {summary.studentTotal === null ? "—" : `${formatPoints(summary.studentTotal)} pontos`}
            </SummaryItem>
            <SummaryItem label="Tempo">
              {exam.timeLimitMinutes ? `${exam.timeLimitMinutes} minutos` : "Sem limite"}
            </SummaryItem>
            <SummaryItem label="Resultado">
              {exam.resultVisibility === "score_only" ? "Só a nota" : "Nota e gabarito"}
            </SummaryItem>
          </dl>

          {!published && summary.issues.length > 0 ? (
            <div className="grid gap-1.5 rounded-md border-[1.5px] border-pen/40 bg-pen/5 p-3 text-sm text-pen">
              <p className="font-medium">Antes de publicar:</p>
              <ul className="grid list-disc gap-1 pl-4">
                {summary.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {published && exam.publishedAt ? (
            <p className="text-xs text-muted-foreground">
              Publicada em <LocalDateTime iso={exam.publishedAt} />.
            </p>
          ) : null}

          <div className="grid gap-3 border-t-[1.5px] border-dashed border-border pt-4">
            {published && exam.assignments.length === 0 ? (
              <div className="grid gap-1.5">
                <p className="text-xs text-muted-foreground">
                  Precisa mudar questões ou regras? Volte a rascunho enquanto nenhuma turma começou.
                </p>
                <div>
                  <ConfirmAction
                    action={unpublishExam.bind(null, exam.id)}
                    label="Voltar a rascunho"
                    confirmLabel="Voltar a rascunho"
                    variant="outline"
                    icon={<Undo2 aria-hidden />}
                  />
                </div>
              </div>
            ) : null}
            {exam.assignments.length === 0 ? (
              <div>
                <ConfirmAction
                  action={deleteExam.bind(null, exam.id)}
                  label="Excluir prova"
                  confirmLabel="Excluir definitivamente"
                  variant="ghost"
                  icon={<Trash2 aria-hidden />}
                />
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function SummaryItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="label-mono text-muted-foreground">{label}</dt>
      <dd className="font-mono text-lg font-medium tabular-nums">{children}</dd>
    </div>
  );
}

function AddQuestionButtons({ examId }: { examId: string }) {
  return (
    <>
      <Link href={`/painel/provas/${examId}/questoes/nova`} className={buttonVariants()}>
        <Plus aria-hidden />
        Escrever questão
      </Link>
      <Link
        href={`/painel/provas/${examId}/banco`}
        className={buttonVariants({ variant: "outline" })}
      >
        <BookOpen aria-hidden />
        Trazer do banco
      </Link>
      <Link
        href={`/painel/provas/${examId}/importar`}
        className={buttonVariants({ variant: "outline" })}
      >
        <FileSpreadsheet aria-hidden />
        Importar planilha
      </Link>
    </>
  );
}

function AssignmentsSection({ exam, now }: { exam: ExamDetail; now: Date }) {
  return (
    <section aria-labelledby="turmas-titulo" className="grid gap-3">
      <h2 id="turmas-titulo" className="text-lg font-semibold">
        Turmas
      </h2>
      {exam.assignments.length === 0 ? (
        <EmptyState
          title="Ainda não aplicada"
          description="Escolha a turma e o horário. A turma recebe um link próprio para os alunos fazerem a prova no celular."
        >
          <Link href={`/painel/provas/${exam.id}/aplicar`} className={buttonVariants()}>
            <Send aria-hidden />
            Aplicar em turma
          </Link>
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {exam.assignments.map((assignment) => {
            const status = assignmentStatus(assignment, now);
            const path = `/p/${assignment.publicCode}`;
            return (
              <li
                key={assignment.id}
                className="grid gap-4 rounded-md border-[1.5px] border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/painel/turmas/${assignment.classId}`}
                    className="font-semibold underline decoration-transparent decoration-[3px] underline-offset-4 hover:decoration-mark"
                  >
                    {assignment.className}
                  </Link>
                  <StatusChip tone={status}>{ASSIGNMENT_STATUS_LABEL[status]}</StatusChip>
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="grid gap-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Abre </span>
                      <LocalDateTime iso={assignment.opensAt} />
                      <span className="text-muted-foreground"> · fecha </span>
                      <LocalDateTime iso={assignment.closedAt ?? assignment.closesAt} />
                    </p>
                    <p className="font-mono text-sm break-all">{path}</p>
                  </div>
                  {assignment.accessCode ? (
                    <div className="grid justify-items-start gap-0.5 sm:justify-items-end">
                      <span className="label-mono text-muted-foreground">Código de acesso</span>
                      <span className="font-mono text-2xl font-medium tracking-[0.2em]">
                        {assignment.accessCode}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-3">
                  <Link
                    href={`/painel/provas/${exam.id}/turmas/${assignment.id}`}
                    className={buttonVariants({ size: "sm" })}
                  >
                    Acompanhar e notas
                  </Link>
                  {status !== "closed" ? <CopyButton path={path} /> : null}
                  {status === "open" ? (
                    <ConfirmAction
                      action={closeAssignmentNow.bind(null, assignment.id)}
                      label="Encerrar agora"
                      confirmLabel="Encerrar a prova nesta turma"
                      variant="ghost"
                    />
                  ) : null}
                  {status === "scheduled" ? (
                    <ConfirmAction
                      action={deleteAssignment.bind(null, assignment.id)}
                      label="Remover aplicação"
                      confirmLabel="Remover desta turma"
                      variant="ghost"
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
