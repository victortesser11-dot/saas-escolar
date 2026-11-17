"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    href: "/painel",
    label: "Turmas",
    isActive: (path: string) =>
      path === "/painel" || path.startsWith("/painel/turmas") || path.startsWith("/painel/alunos"),
  },
  {
    href: "/painel/provas",
    label: "Provas",
    isActive: (path: string) => path.startsWith("/painel/provas"),
  },
  {
    href: "/painel/questoes",
    label: "Questões",
    isActive: (path: string) => path.startsWith("/painel/questoes"),
  },
];

/** Navegação principal do painel; a aba ativa recebe o traço de marca-texto. */
export function DashboardNav() {
  return <NavLinks pathname={usePathname()} />;
}

/**
 * Mesma navegação sem aba ativa: exibida enquanto a URL ainda não está disponível
 * (rotas dinâmicas pré-renderizadas pelo Next 16).
 */
export function DashboardNavFallback() {
  return <NavLinks pathname={null} />;
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Seções do painel" className="flex gap-1">
      {ITEMS.map((item) => {
        const active = pathname !== null && item.isActive(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-sm px-3 py-2 text-sm font-medium outline-none focus-visible:ring-4 focus-visible:ring-ring",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {active ? (
              <span aria-hidden className="absolute inset-x-3 -bottom-px h-[3px] bg-mark" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
