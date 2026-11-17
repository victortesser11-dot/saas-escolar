import { ArrowUpRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusChip } from "@/components/status-chip";
import { buttonVariants } from "@/components/ui/button";
import { pluralize } from "@/lib/classes/messages";
import { listExams } from "@/lib/exams/queries";

export const metadata: Metadata = { title: "Provas" };

export default function ExamsPage() {
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Provas"
        description="Monte a prova uma vez e aplique em quantas turmas quiser. Cada turma recebe o próprio link e horário."
        actions={
          <Link href="/painel/provas/nova" className={buttonVariants()}>
            <Plus aria-hidden />
            Nova prova
          </Link>
        }
      />
      <Suspense fallback={<div className="h-48 animate-pulse rounded-md bg-muted" />}>
        <ExamList />
      </Suspense>
    </div>
  );
}

async function ExamList() {
  const exams = await listExams();

  if (exams.length === 0) {
    return (
      <EmptyState
        title="Nenhuma prova ainda"
        description="Crie uma prova, escreva as questões direto nela (ou traga do seu banco), publique e aplique nas turmas."
      >
        <Link href="/painel/provas/nova" className={buttonVariants()}>
          <Plus aria-hidden />
          Criar primeira prova
        </Link>
      </EmptyState>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {exams.map((exam) => (
        <li key={exam.id}>
          <Link
            href={`/painel/provas/${exam.id}`}
            className="group grid h-full gap-4 rounded-md border-[1.5px] border-border bg-card p-4 transition-[border-color,box-shadow] outline-none hover:border-foreground hover:shadow-[3px_3px_0_var(--mark)] focus-visible:border-foreground focus-visible:ring-4 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 text-lg leading-snug font-semibold break-words">
                {exam.title}
              </span>
              <ArrowUpRight
                className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                aria-hidden
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t-[1.5px] border-dashed border-border pt-3">
              <StatusChip tone={exam.status === "published" ? "published" : "draft"}>
                {exam.status === "published" ? "Publicada" : "Rascunho"}
              </StatusChip>
              <span className="font-mono text-sm tabular-nums">
                {pluralize(exam.questionCount, "questão", "questões")}
              </span>
              <span className="min-w-0 truncate text-sm text-muted-foreground">
                {exam.classNames.length > 0 ? exam.classNames.join(", ") : "Ainda não aplicada"}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
