import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <ClipboardCheck className="size-4" aria-hidden />
      </span>
      <span>Avaliações Escolares</span>
    </Link>
  );
}
