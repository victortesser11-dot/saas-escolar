import { CircleAlert, CircleCheck, CircleMinus, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { formatPoints } from "@/lib/questions/points";
import {
  BAND_LABEL,
  bandOf,
  SITUATION_LABEL,
  type Band,
  type Situation,
} from "@/lib/results/stats";
import { cn } from "@/lib/utils";

/** Número de destaque com rótulo: o resumo vem antes do detalhe. */
export function KpiTile({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "default" | "alert";
}) {
  return (
    <div
      className={cn(
        "grid content-start gap-1 rounded-md border-[1.5px] bg-card p-4",
        tone === "alert" ? "border-pen/50" : "border-border",
      )}
    >
      <dt className="label-mono text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-mono text-2xl font-medium tabular-nums",
          tone === "alert" && "text-pen",
        )}
      >
        {value}
      </dd>
      {detail ? <dd className="text-xs text-muted-foreground">{detail}</dd> : null}
    </div>
  );
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</dl>;
}

const BAND_STYLE: Record<Band, string> = {
  good: "text-ok",
  attention: "text-warn",
  low: "text-pen",
};

const BAND_ICON: Record<Band, ReactNode> = {
  good: <CircleCheck className="size-3.5" aria-hidden />,
  attention: <CircleMinus className="size-3.5" aria-hidden />,
  low: <CircleAlert className="size-3.5" aria-hidden />,
};

/**
 * Nota com faixa de desempenho. A cor nunca aparece sozinha: há ícone e,
 * no título (hover/leitor de tela), o nome da faixa.
 */
export function ScoreBadge({
  percent,
  score,
  maxScore,
  partial = false,
  compact = false,
}: {
  percent: number | null;
  score?: number | null;
  maxScore?: number | null;
  partial?: boolean;
  compact?: boolean;
}) {
  if (percent === null) return <span className="text-muted-foreground">—</span>;
  const band = bandOf(percent);
  const points =
    score !== undefined && score !== null && maxScore
      ? `${formatPoints(score)}/${formatPoints(maxScore)}`
      : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-sm tabular-nums",
        BAND_STYLE[band],
      )}
      title={`${BAND_LABEL[band]}${partial ? " · nota parcial, aguarda correção" : ""}`}
    >
      {BAND_ICON[band]}
      <span>{formatPoints(percent)}%</span>
      {!compact && points ? <span className="text-muted-foreground">({points})</span> : null}
      {partial ? <span className="text-muted-foreground">*</span> : null}
    </span>
  );
}

export function BandLegend() {
  return (
    <ul
      className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
      aria-label="Faixas de desempenho"
    >
      {(["good", "attention", "low"] as Band[]).map((band) => (
        <li key={band} className={cn("inline-flex items-center gap-1", BAND_STYLE[band])}>
          {BAND_ICON[band]}
          <span className="text-muted-foreground">{BAND_LABEL[band]}</span>
        </li>
      ))}
      <li>* nota parcial, aguarda correção</li>
    </ul>
  );
}

const SITUATION_STYLE: Record<Situation, string> = {
  not_started: "border-border text-muted-foreground",
  absent: "border-border bg-secondary text-muted-foreground",
  in_progress: "border-foreground bg-mark text-foreground",
  interrupted: "border-pen bg-pen text-white",
  pending_review: "border-foreground text-foreground",
  graded: "border-ok/50 text-ok",
  expired: "border-warn/60 text-warn",
};

export function SituationChip({ situation }: { situation: Situation }) {
  return (
    <span
      className={cn(
        "label-mono inline-flex h-6 items-center gap-1 rounded-sm border-[1.5px] px-2 text-[0.68rem] whitespace-nowrap",
        SITUATION_STYLE[situation],
      )}
    >
      {situation === "pending_review" ? <Clock className="size-3" aria-hidden /> : null}
      {SITUATION_LABEL[situation]}
    </span>
  );
}
