import { formatPoints } from "@/lib/questions/points";
import type { Bin } from "@/lib/results/stats";
import { cn } from "@/lib/utils";

/*
 * Gráficos de série única em HTML/CSS (sem biblioteca): barras finas com ponta
 * arredondada ancorada na base, grade discreta, rótulos seletivos, dica ao passar
 * o mouse (title) e tabela equivalente para leitores de tela.
 */

/** Distribuição das notas em faixas de aproveitamento (colunas). */
export function DistributionChart({ bins, total }: { bins: Bin[]; total: number }) {
  const maxCount = Math.max(1, ...bins.map((b) => b.count));

  return (
    <figure className="grid gap-3">
      <div
        className="relative grid h-44 grid-cols-5 items-end gap-2 border-b-[1.5px] border-foreground px-1"
        aria-hidden
      >
        {/* Linhas de grade em 50% e 100% da maior coluna */}
        <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
        <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
        {bins.map((bin) => {
          const height = (bin.count / maxCount) * 100;
          const share = total > 0 ? Math.round((bin.count / total) * 100) : 0;
          return (
            <div
              key={bin.label}
              className="group relative flex h-full flex-col items-center justify-end"
              title={`${bin.label}: ${bin.count} ${bin.count === 1 ? "aluno" : "alunos"} (${share}%)`}
            >
              {bin.count > 0 ? (
                <span className="mb-1 font-mono text-xs tabular-nums">{bin.count}</span>
              ) : null}
              <span
                className="w-full max-w-12 rounded-t-[4px] bg-foreground transition-opacity group-hover:opacity-80"
                style={{ height: `${Math.max(height, bin.count > 0 ? 3 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div
        className="grid grid-cols-5 gap-2 px-1 text-center font-mono text-[0.68rem] text-muted-foreground"
        aria-hidden
      >
        {bins.map((bin) => (
          <span key={bin.label}>{bin.label}</span>
        ))}
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>Distribuição das notas por faixa de aproveitamento</caption>
          <thead>
            <tr>
              <th>Faixa</th>
              <th>Alunos</th>
            </tr>
          </thead>
          <tbody>
            {bins.map((bin) => (
              <tr key={bin.label}>
                <td>{bin.label}</td>
                <td>{bin.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

export type QuestionBar = {
  key: string;
  label: string;
  detail: string;
  percent: number | null;
  note?: string;
};

/** Aproveitamento por questão (barras horizontais), com a mais difícil destacada. */
export function QuestionChart({ rows }: { rows: QuestionBar[] }) {
  const values = rows.map((r) => r.percent).filter((p): p is number => p !== null);
  const hardest = values.length > 1 ? Math.min(...values) : null;

  return (
    <ul className="grid min-w-0 grid-cols-1 gap-3">
      {rows.map((row) => {
        const isHardest = hardest !== null && row.percent === hardest;
        return (
          <li
            key={row.key}
            className="grid min-w-0 grid-cols-1 gap-1.5"
            title={
              row.percent === null
                ? (row.note ?? "Sem dados")
                : `${row.label}: ${formatPoints(row.percent)}% de acerto`
            }
          >
            <div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 gap-1.5">
                <span className="shrink-0 font-mono text-muted-foreground">{row.label}</span>
                {/* O próprio texto corta com reticências (não um contêiner em volta). */}
                <span className="min-w-0 truncate">{row.detail}</span>
              </span>
              <span className="shrink-0 font-mono tabular-nums">
                {row.percent === null ? (
                  <span className="text-muted-foreground">{row.note ?? "—"}</span>
                ) : (
                  <>
                    {formatPoints(row.percent)}%
                    {isHardest ? <span className="ml-1.5 text-pen">mais difícil</span> : null}
                  </>
                )}
              </span>
            </div>
            <div className="h-2.5 rounded-[4px] bg-secondary" aria-hidden>
              {row.percent !== null ? (
                <div
                  className={cn("h-full rounded-[4px]", isHardest ? "bg-pen" : "bg-foreground")}
                  style={{ width: `${Math.max(row.percent, 1)}%` }}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
