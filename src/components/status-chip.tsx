import { cn } from "@/lib/utils";

const STYLES = {
  draft: "border-dashed border-foreground/50 text-muted-foreground",
  published: "border-foreground bg-foreground text-background",
  scheduled: "border-foreground/50 text-foreground",
  open: "border-foreground bg-mark text-foreground",
  closed: "border-border bg-secondary text-muted-foreground",
} as const;

/** Etiqueta de estado (prova ou aplicação). */
export function StatusChip({ tone, children }: { tone: keyof typeof STYLES; children: string }) {
  return (
    <span
      className={cn(
        "label-mono inline-flex h-6 items-center rounded-sm border-[1.5px] px-2 text-[0.7rem]",
        STYLES[tone],
      )}
    >
      {children}
    </span>
  );
}
