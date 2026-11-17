import type { ReactNode } from "react";

/** Bloco das telas de autenticação: título com marca-texto, descrição e formulário. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="hl">{title}</span>
        </h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-4">{children}</div>
      {footer ? (
        <p className="border-t-[1.5px] border-dashed border-border pt-4 text-sm text-muted-foreground">
          {footer}
        </p>
      ) : null}
    </div>
  );
}
