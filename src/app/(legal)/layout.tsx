import Link from "next/link";
import { Brand } from "@/components/brand";
import { LegalLinks } from "@/components/legal-links";
import { LEGAL } from "@/lib/legal";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-graph flex flex-1 flex-col">
      <header className="px-4 py-5 sm:px-8">
        <Brand />
      </header>
      <main className="flex-1 px-4 pb-16 sm:px-8">
        <article
          className={[
            "mx-auto grid max-w-2xl gap-4 rounded-md border-[1.5px] border-border bg-card px-5 py-8 text-[0.95rem] leading-relaxed sm:px-10 sm:py-10",
            "[&_h1]:text-3xl [&_h1]:leading-tight [&_h1]:font-bold [&_h1]:tracking-tight",
            "[&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold",
            "[&_h3]:mt-2 [&_h3]:font-semibold",
            "[&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1.5 [&_ul]:pl-5 [&_ul]:marker:text-muted-foreground",
            "[&_a]:underline [&_a]:underline-offset-2",
          ].join(" ")}
        >
          {children}
          <p className="mt-6 border-t border-dashed border-border pt-4 font-mono text-xs text-muted-foreground">
            Versão {LEGAL.version} · atualizada em {LEGAL.updatedAt}
          </p>
        </article>
        <div className="mx-auto mt-6 flex max-w-2xl justify-between gap-4 text-sm">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            ← Início
          </Link>
          <LegalLinks />
        </div>
      </main>
    </div>
  );
}
