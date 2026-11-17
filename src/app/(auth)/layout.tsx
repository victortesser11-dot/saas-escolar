import { Brand } from "@/components/brand";
import { GradeMark } from "@/components/grade-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-graph grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col">
        <header className="px-4 py-5 sm:px-8">
          <Brand />
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pt-4 pb-16 sm:items-center sm:pt-0">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>

      <aside className="hidden flex-col items-center justify-center gap-6 border-l-[1.5px] border-dashed border-border px-10 lg:flex">
        <GradeMark grade="9,5" caption="Corrigida automaticamente" />
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          A prova é feita no celular do aluno e a nota sai na hora, sem pilha de papel para
          corrigir.
        </p>
      </aside>
    </div>
  );
}
