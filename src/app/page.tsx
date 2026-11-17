// Página provisória da Etapa 0. A página inicial definitiva será desenhada em etapa própria.
export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Avaliações Escolares</h1>
        <p className="mt-3 text-muted-foreground">
          Plataforma em desenvolvimento. Em breve, professores poderão criar, aplicar e corrigir
          provas digitais no celular dos alunos.
        </p>
      </div>
    </main>
  );
}
