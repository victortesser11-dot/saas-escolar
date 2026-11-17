import Link from "next/link";
import { Suspense } from "react";
import { BrandMark, Brand } from "@/components/brand";
import { ROUTES } from "@/lib/auth/routes";
import { DashboardNav, DashboardNavFallback } from "./dashboard-nav";
import { UserMenu } from "./user-menu";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b-[1.5px] border-foreground bg-card">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-3 sm:gap-8 sm:px-6">
          <Brand href={ROUTES.dashboard} className="hidden text-sm sm:inline-flex" />
          <Link
            href={ROUTES.dashboard}
            className="rounded-sm outline-none focus-visible:ring-4 focus-visible:ring-ring sm:hidden"
          >
            <BrandMark />
            <span className="sr-only">Avaliações Escolares</span>
          </Link>
          <div className="flex-1 self-stretch">
            <div className="flex h-full items-end">
              <Suspense fallback={<DashboardNavFallback />}>
                <DashboardNav />
              </Suspense>
            </div>
          </div>
          {/* Lê a sessão: fica num limite de Suspense para não bloquear o restante da página. */}
          <Suspense fallback={<div className="h-8 w-24 animate-pulse rounded-sm bg-muted" />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
