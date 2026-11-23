import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { KpiRow, KpiTile, ScoreBadge } from "@/components/results/indicators";
import { buttonVariants } from "@/components/ui/button";
import { pluralize } from "@/lib/classes/messages";
import { formatPoints } from "@/lib/questions/points";
import { getGradesOverview } from "@/lib/results/queries";

export const metadata: Metadata = { title: "Notas" };

export default function GradesPage() {
  return (
    <div className="grid grid-cols-1 gap-8">
      <PageHeader
        title="Notas"
        description="Desempenho das suas turmas em aproveitamento (% da nota máxima), para comparar provas de valores diferentes."
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-muted" />}>
        <Overview />
      </Suspense>
    </div>
  );
}

async function Overview() {
  const classes = await getGradesOverview();
  const withGrades = classes.filter((c) => c.meanPercent !== null);

  if (classes.length === 0) {
    return (
      <EmptyState
        title="Nenhuma turma ainda"
        description="Crie uma turma, aplique uma prova e as notas aparecem aqui."
      >
        <Link href="/painel/turmas/nova" className={buttonVariants()}>
          Criar turma
        </Link>
      </EmptyState>
    );
  }

  const pending = classes.reduce((sum, c) => sum + c.pendingReviews, 0);
  const low = classes.reduce((sum, c) => sum + c.lowCount, 0);
  const overall = withGrades.length
    ? Math.round(
        (withGrades.reduce((s, c) => s + (c.meanPercent ?? 0), 0) / withGrades.length) * 10,
      ) / 10
    : null;

  return (
    <div className="grid grid-cols-1 gap-8">
      <KpiRow>
        <KpiTile label="Turmas" value={classes.length} detail={`${withGrades.length} com notas`} />
        <KpiTile
          label="Média geral"
          value={overall === null ? "—" : `${formatPoints(overall)}%`}
          detail="Média das médias das turmas"
        />
        <KpiTile
          label="Notas abaixo de 50%"
          value={low}
          tone={low > 0 ? "alert" : "default"}
          detail="Somando todas as provas"
        />
        <KpiTile
          label="Para corrigir"
          value={pending}
          tone={pending > 0 ? "alert" : "default"}
          detail={pending > 0 ? "Provas com dissertativa" : "Nada pendente"}
        />
      </KpiRow>

      <ul className="grid gap-3 sm:grid-cols-2">
        {classes.map((c) => (
          <li key={c.classId}>
            <Link
              href={`/painel/notas/${c.classId}`}
              className="group grid h-full gap-4 rounded-md border-[1.5px] border-border bg-card p-4 transition-[border-color,box-shadow] outline-none hover:border-foreground hover:shadow-[3px_3px_0_var(--mark)] focus-visible:border-foreground focus-visible:ring-4 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-lg leading-snug font-semibold break-words">
                  {c.name}
                </span>
                <ArrowUpRight
                  className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                  aria-hidden
                />
              </div>
              <dl className="grid grid-cols-3 gap-3 border-t-[1.5px] border-dashed border-border pt-3 text-sm">
                <div className="grid gap-0.5">
                  <dt className="label-mono text-muted-foreground">Média</dt>
                  <dd>
                    <ScoreBadge percent={c.meanPercent} compact />
                  </dd>
                </div>
                <div className="grid gap-0.5">
                  <dt className="label-mono text-muted-foreground">Provas</dt>
                  <dd className="font-mono tabular-nums">{c.examCount}</dd>
                </div>
                <div className="grid gap-0.5">
                  <dt className="label-mono text-muted-foreground">Corrigir</dt>
                  <dd className={c.pendingReviews > 0 ? "font-mono text-pen" : "font-mono"}>
                    {c.pendingReviews}
                  </dd>
                </div>
              </dl>
              <span className="text-xs text-muted-foreground">
                {[
                  c.subjectNames.join(", "),
                  pluralize(c.studentCount, "aluno", "alunos"),
                  c.schoolYear ? String(c.schoolYear) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
