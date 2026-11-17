import { cn } from "@/lib/utils";

/**
 * Nota circulada à mão em caneta vermelha: a assinatura visual da identidade.
 * Decorativa (aria-hidden); quando a nota for informação real, exponha-a em texto também.
 */
export function GradeMark({
  grade,
  caption,
  className,
}: {
  grade: string;
  caption?: string;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("relative inline-grid justify-items-center", className)}>
      <div className="relative grid place-items-center px-10 py-6">
        <svg
          viewBox="0 0 170 110"
          fill="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
        >
          <path
            d="M18 58c2-30 46-46 84-42 34 4 56 22 50 46-6 26-48 38-86 34C34 92 14 78 22 50c4-14 18-24 30-28"
            stroke="var(--pen)"
            strokeWidth="3"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="relative font-mono text-6xl leading-none font-medium tracking-[-0.12em] text-pen tabular-nums">
          {grade}
        </span>
      </div>
      {caption ? <span className="label-mono mt-3 text-muted-foreground">{caption}</span> : null}
    </div>
  );
}
