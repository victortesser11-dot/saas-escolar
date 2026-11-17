import { Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Marca: um "certo" dentro de um quadrado de caderno. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 items-center justify-center rounded-sm border-2 border-foreground bg-card",
        className,
      )}
    >
      <Check className="size-4" strokeWidth={3} />
    </span>
  );
}

export function Brand({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-sm font-semibold tracking-tight outline-none focus-visible:ring-4 focus-visible:ring-ring",
        className,
      )}
    >
      <BrandMark />
      <span>Avaliações Escolares</span>
    </Link>
  );
}
