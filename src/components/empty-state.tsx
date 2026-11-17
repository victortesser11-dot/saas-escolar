import type { ReactNode } from "react";

/** Estado vazio sobre papel quadriculado: diz o que vai aparecer e como começar. */
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="bg-graph grid justify-items-center gap-3 rounded-md border-[1.5px] border-dashed border-border px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {children ? <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}
