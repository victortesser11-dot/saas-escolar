import Link from "next/link";
import { cn } from "@/lib/utils";
import { LEGAL_ROUTES } from "@/lib/legal";

/** Links discretos para Termos e Privacidade (rodapés). */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Documentos legais" className={cn("flex gap-4 text-sm", className)}>
      <Link href={LEGAL_ROUTES.terms} className="text-muted-foreground hover:text-foreground">
        Termos de uso
      </Link>
      <Link href={LEGAL_ROUTES.privacy} className="text-muted-foreground hover:text-foreground">
        Privacidade
      </Link>
    </nav>
  );
}
