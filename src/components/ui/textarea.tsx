import * as React from "react";
import { cn } from "cn";

/** Área de texto com o mesmo traço dos campos; cresce com o conteúdo. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content min-h-24 w-full min-w-0 resize-y rounded-md border-[1.5px] border-input bg-card px-3 py-2 text-base leading-relaxed text-foreground transition-shadow outline-none placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/15 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
