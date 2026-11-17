import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { LocalDateTime } from "@/components/local-date-time";
import { PageHeader } from "@/components/page-header";
import {
  BandLegend,
  KpiRow,
  KpiTile,
  ScoreBadge,
  SituationChip,
} from "@/components/results/indicators";
import { buttonVariants } from "@/components/ui/button";
import { formatPoints } from "@/lib/questions/points";
import { getClassGradebook } from "@/lib/results/queries";
import { summarize } from "@/lib/results/stats";

type Props = PageProps<"/painel/notas/[classId]">;

export default function ClassGradesPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
      <Content params={params} />
    </Suspense>
  );
}

const mean = (values: number[]) =>
  values.length ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10 : null;

async function Content({ params }: Pick<Props, "params">) {
  const { classId } = await params;
  const { turma, columns, students } = await getClassGradebook(classId);

  // Média por prova (coluna) e por aluno (linha), só com notas existentes.
  const columnMeans = columns.map((_, i) =>
    mean(students.map((s) => s.cells[i].percent).filter((p): p is number => p !== null)),
  );
  const rows = students.map((s) => {
    const values = s.cells.map((c) => c.percent).filter((p): p is number => p !== null);
    const finalValues = s.cells
      .filter((c) => !c.partial)
      .map((c) => c.percent)
      .filter((p): p is number => p !== null);
    return { ...s, mean: mean(values), finalMean: mean(finalValues), done: values.length };
  });
  const allPercents = rows.flatMap((r) =>
    r.cells.map((c) => c.percent).filter((p): p is number => p !== null),
  );
  const overall = summarize(rows.map((r) => r.mean).filter((m): m is number => m !== null));
  // Atenção só com notas finais (dissertativa não corrigida conta zero por enquanto).
  const attention = rows.filter((r) => r.finalMean !== null && r.finalMean < 50);
  const pending = students.reduce(
    (sum, s) => sum + s.cells.filter((c) => c.situation === "pending_review").length,
    0,
  );
  const expected = students.length * columns.filter((c) => c.closed).length;
  const delivered = students.reduce(
    (sum, s) => sum + s.cells.filter((c, i) => columns[i].closed && c.percent !== null).length,
    0,
  );

  return (
    <div className="grid grid-cols-1 gap-8">
      <title>{`Notas · ${turma.name} · Avaliações Escolares`}</title>
      <PageHeader
        back={{ href: "/painel/notas", label: "Notas" }}
        eyebrow={turma.schoolYear ? `Ano ${turma.schoolYear}` : "Turma"}
        title={turma.name}
        actions={
          <Link
            href={`/painel/turmas/${turma.id}`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Alunos da turma
          </Link>
        }
      />

      {columns.length === 0 ? (
        <EmptyState
          title="Nenhuma prova aplicada nesta turma"
          description="Publique uma prova e aplique nesta turma para acompanhar as notas aqui."
        >
          <Link href="/painel/provas" className={buttonVariants()}>
            Ir para provas
          </Link>
        </EmptyState>
      ) : (
        <>
          <KpiRow>
            <KpiTile
              label="Média da turma"
              value={overall.mean === null ? "—" : `${formatPoints(overall.mean)}%`}
              detail={
                overall.median === null
                  ? "Sem notas ainda"
                  : `Mediana ${formatPoints(overall.median)}%`
              }
            />
            <KpiTile
              label="Entregas"
              value={expected > 0 ? `${Math.round((delivered / expected) * 100)}%` : "—"}
              detail={
                expected > 0
                  ? `${delivered} de ${expected} nas provas encerradas`
                  : "Nenhuma prova encerrada"
              }
            />
            <KpiTile
              label="Alunos em atenção"
              value={attention.length}
              tone={attention.length > 0 ? "alert" : "default"}
              detail={
                pending > 0 ? "Média final abaixo de 50% (sem parciais)" : "Média abaixo de 50%"
              }
            />
            <KpiTile
              label="Para corrigir"
              value={pending}
              tone={pending > 0 ? "alert" : "default"}
              detail={`${allPercents.length} notas lançadas`}
            />
          </KpiRow>

          {attention.length > 0 ? (
            <p className="rounded-md border-[1.5px] border-dashed border-pen/50 bg-card px-4 py-3 text-sm">
              <span className="font-medium text-pen">Em atenção:</span>{" "}
              {attention.map((r) => `${r.fullName} (${formatPoints(r.finalMean!)}%)`).join(", ")}.
            </p>
          ) : null}

          <section aria-labelledby="boletim" className="grid grid-cols-1 gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="boletim" className="text-lg font-semibold">
                Boletim
              </h2>
              <BandLegend />
            </div>
            <div className="relative overflow-x-auto rounded-md border-[1.5px] border-border bg-card">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-[1.5px] border-foreground text-left align-bottom">
                    <th
                      scope="col"
                      className="label-mono sticky left-0 z-10 min-w-44 bg-card px-4 py-2.5 font-normal text-muted-foreground"
                    >
                      Aluno
                    </th>
                    {columns.map((c) => (
                      <th
                        key={c.assignmentId}
                        scope="col"
                        className="min-w-36 px-3 py-2.5 font-normal"
                      >
                        <Link
                          href={`/painel/provas/${c.examId}/turmas/${c.assignmentId}`}
                          className="grid gap-0.5 hover:underline"
                        >
                          <span className="line-clamp-2 font-medium">{c.title}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            <LocalDateTime iso={c.opensAt} style="date" />
                          </span>
                        </Link>
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="label-mono min-w-28 px-3 py-2.5 font-normal text-muted-foreground"
                    >
                      Média
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.studentId}
                      className="border-b border-border last:border-b-0 hover:bg-paper"
                    >
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-card px-4 py-2.5 text-left font-medium"
                      >
                        {r.fullName}
                        <span className="block font-mono text-xs font-normal text-muted-foreground">
                          {r.registrationCode}
                        </span>
                      </th>
                      {r.cells.map((cell, i) => (
                        <td key={columns[i].assignmentId} className="px-3 py-2.5">
                          {cell.percent !== null && cell.attemptId ? (
                            <Link
                              href={`/painel/provas/${columns[i].examId}/turmas/${columns[i].assignmentId}/alunos/${cell.attemptId}`}
                              className="rounded-sm hover:underline"
                            >
                              <ScoreBadge percent={cell.percent} partial={cell.partial} compact />
                            </Link>
                          ) : cell.situation === "absent" || cell.situation === "not_started" ? (
                            <span className="text-xs text-muted-foreground">
                              {cell.situation === "absent" ? "não fez" : "—"}
                            </span>
                          ) : (
                            <SituationChip situation={cell.situation} />
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2.5">
                        <ScoreBadge percent={r.mean} compact />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-[1.5px] border-foreground">
                    <th
                      scope="row"
                      className="label-mono sticky left-0 z-10 bg-card px-4 py-2.5 text-left font-normal text-muted-foreground"
                    >
                      Média da prova
                    </th>
                    {columnMeans.map((m, i) => (
                      <td key={columns[i].assignmentId} className="px-3 py-2.5">
                        <ScoreBadge percent={m} compact />
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      <ScoreBadge percent={overall.mean} compact />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Valores em aproveitamento (% da nota máxima de cada prova). Toque numa nota para ver
              as respostas do aluno.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
