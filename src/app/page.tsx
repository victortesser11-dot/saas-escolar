import Link from "next/link";
import { Brand } from "@/components/brand";
import { GradeMark } from "@/components/grade-mark";
import { LegalLinks } from "@/components/legal-links";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/lib/auth/routes";

// Página inicial provisória. A página de apresentação definitiva será desenhada em etapa própria.
export default function Home() {
  return (
    <div className="bg-graph flex flex-1 flex-col">
      <header className="flex items-center justify-between px-4 py-5 sm:px-8">
        <Brand />
        <Link href={ROUTES.signIn} className={buttonVariants({ variant: "ghost" })}>
          Entrar
        </Link>
      </header>
      <main className="flex flex-1 items-center px-4 py-16 sm:px-8">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="grid gap-6">
            <h1 className="text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl">
              Avaliações Escolares
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground">
              Crie a prova, compartilhe um link e os alunos respondem{" "}
              <span className="hl text-foreground">no próprio celular</span>. A correção sai na
              hora.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href={ROUTES.signUp} className={buttonVariants({ size: "lg" })}>
                Criar conta grátis
              </Link>
              <Link
                href={ROUTES.signIn}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Já tenho conta
              </Link>
            </div>
          </div>
          <div className="hidden justify-center lg:flex">
            <GradeMark grade="10" caption="7º ano B · Frações" />
          </div>
        </div>
      </main>
      <footer className="px-4 pb-6 sm:px-8">
        <LegalLinks />
      </footer>
    </div>
  );
}
