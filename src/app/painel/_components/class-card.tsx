import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { pluralize } from "@/lib/classes/messages";
import type { ClassSummary } from "@/lib/classes/queries";

export function ClassCard({ item }: { item: ClassSummary }) {
  return (
    <Link
      href={`/painel/turmas/${item.id}`}
      className="group grid h-full gap-6 rounded-md border-[1.5px] border-border bg-card p-4 transition-[border-color,box-shadow] outline-none hover:border-foreground hover:shadow-[3px_3px_0_var(--mark)] focus-visible:border-foreground focus-visible:ring-4 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-lg leading-snug font-semibold break-words">{item.name}</span>
        <ArrowUpRight
          className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
          aria-hidden
        />
      </div>
      <div className="flex items-center justify-between gap-3 border-t-[1.5px] border-dashed border-border pt-3">
        <span className="label-mono text-muted-foreground">
          {item.schoolYear ? `Ano ${item.schoolYear}` : "Sem ano letivo"}
        </span>
        <span className="font-mono text-sm tabular-nums">
          {pluralize(item.studentCount, "aluno", "alunos")}
        </span>
      </div>
    </Link>
  );
}

export function ClassGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[118px] animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}
