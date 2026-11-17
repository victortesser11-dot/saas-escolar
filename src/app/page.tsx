import Link from "next/link";
import { Brand } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/lib/auth/routes";
import { cn } from "@/lib/utils";

// Página inicial provisória. A página de apresentação definitiva será desenhada em etapa própria.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-4 py-5 sm:px-8">
        <Brand />
        <Link href={ROUTES.signIn} className={buttonVariants({ variant: "ghost" })}>
          Entrar
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="max-w-lg text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Avaliações Escolares
          </h1>
          <p className="mt-4 text-muted-foreground">
            Crie, aplique e corrija provas digitais usando o celular dos próprios alunos.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={ROUTES.signUp} className={cn(buttonVariants({ size: "lg" }), "h-10 px-5")}>
              Criar conta grátis
            </Link>
            <Link
              href={ROUTES.signIn}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-5")}
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
