import { Check, Clock, X } from "lucide-react";
import { GradeMark } from "@/components/grade-mark";
import { formatPoints } from "@/lib/questions/points";
import type { AttemptResult, ResultItem } from "@/lib/student/api";
import { cn } from "@/lib/utils";

/** Resultado do aluno: nota circulada e, se a prova permitir, o gabarito comentado. */
export function ResultView({ result }: { result: AttemptResult }) {
  const score = result.score ?? 0;
  const max = result.max_score ?? 0;

  return (
    <div className="grid gap-8">
      <div className="grid justify-items-center gap-4 text-center">
        <h1 className="text-2xl font-bold">
          <span className="hl">
            {result.finalize_reason === "expired" ? "Tempo esgotado" : "Prova enviada"}
          </span>
        </h1>
        {result.finalize_reason === "expired" ? (
          <p className="max-w-sm text-muted-foreground">
            Enviamos automaticamente as respostas que você já tinha marcado.
          </p>
        ) : null}

        <GradeMark grade={formatPoints(score)} caption={`de ${formatPoints(max)} pontos`} />
        <p className="sr-only">
          Sua nota: {formatPoints(score)} de {formatPoints(max)} pontos.
        </p>

        {result.pending_review ? (
          <p className="max-w-sm rounded-md border-[1.5px] border-dashed border-foreground/40 bg-card px-4 py-3 text-sm">
            <strong>Nota parcial.</strong> Há questões dissertativas aguardando a correção do
            professor; a nota final pode aumentar depois dela.
          </p>
        ) : null}
      </div>

      {result.items ? (
        <section className="grid gap-3" aria-labelledby="gabarito-titulo">
          <h2 id="gabarito-titulo" className="text-lg font-semibold">
            Suas respostas
          </h2>
          <ol className="grid gap-3">
            {result.items.map((item) => (
              <ResultItemCard key={item.position} item={item} />
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function ResultItemCard({ item }: { item: ResultItem }) {
  const yours = Array.isArray(item.your_answer)
    ? item.your_answer.join("; ")
    : (item.your_answer ?? "");
  const state = item.needs_review ? "review" : item.is_correct ? "right" : "wrong";

  return (
    <li
      className={cn(
        "grid gap-3 rounded-md border-[1.5px] bg-card p-4",
        state === "right" && "border-ok/50",
        state === "wrong" && "border-pen/50",
        state === "review" && "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-sm text-muted-foreground">
          {String(item.position).padStart(2, "0")}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 font-mono text-sm",
            state === "right" && "text-ok",
            state === "wrong" && "text-pen",
            state === "review" && "text-muted-foreground",
          )}
        >
          {state === "right" ? <Check className="size-4" aria-hidden /> : null}
          {state === "wrong" ? <X className="size-4" aria-hidden /> : null}
          {state === "review" ? <Clock className="size-4" aria-hidden /> : null}
          {state === "review"
            ? "aguardando correção"
            : `${formatPoints(item.points_awarded ?? 0)}/${formatPoints(item.points)}`}
        </span>
      </div>
      <p className="leading-relaxed break-words whitespace-pre-line">{item.stem}</p>
      <dl className="grid gap-2 text-sm">
        <div className="grid gap-0.5">
          <dt className="label-mono text-muted-foreground">Sua resposta</dt>
          <dd className={cn("break-words whitespace-pre-line", !yours && "text-muted-foreground")}>
            {yours || "Em branco"}
          </dd>
        </div>
        {item.correct_answer && state !== "right" ? (
          <div className="grid gap-0.5">
            <dt className="label-mono text-muted-foreground">Resposta correta</dt>
            <dd className="break-words text-ok">{item.correct_answer.join("; ")}</dd>
          </div>
        ) : null}
      </dl>
    </li>
  );
}
