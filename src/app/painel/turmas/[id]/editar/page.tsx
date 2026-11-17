import { Archive, Trash2 } from "lucide-react";
import { Suspense } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { PageHeader } from "@/components/page-header";
import { getClassDetail } from "@/lib/classes/queries";
import { deleteClass, setClassArchived, updateClass } from "../../../actions";
import { ClassForm } from "../../../_components/class-form";

export default function EditClassPage({ params }: PageProps<"/painel/turmas/[id]/editar">) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted" />}>
      <EditClassContent params={params} />
    </Suspense>
  );
}

async function EditClassContent({
  params,
}: Pick<PageProps<"/painel/turmas/[id]/editar">, "params">) {
  const { id } = await params;
  const turma = await getClassDetail(id);

  return (
    <div className="grid gap-10">
      <title>{`Editar ${turma.name} · Avaliações Escolares`}</title>
      <PageHeader
        back={{ href: `/painel/turmas/${turma.id}`, label: turma.name }}
        title="Editar turma"
      />

      <ClassForm
        action={updateClass.bind(null, turma.id)}
        defaults={{
          name: turma.name,
          schoolYear: turma.schoolYear ? String(turma.schoolYear) : "",
        }}
        submitLabel="Salvar alterações"
      />

      <section
        aria-labelledby="zona-titulo"
        className="grid max-w-2xl gap-5 border-t-[1.5px] border-dashed border-border pt-8"
      >
        <h2 id="zona-titulo" className="text-lg font-semibold">
          Arquivar ou excluir
        </h2>

        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Arquivar</strong> tira a turma da lista principal ao
            fim do ano letivo. Alunos e, futuramente, provas e notas ficam guardados e a turma pode
            ser reativada.
          </p>
          <div>
            <ConfirmAction
              action={setClassArchived.bind(null, turma.id, true)}
              label="Arquivar turma"
              confirmLabel="Arquivar"
              question="Arquivar esta turma?"
              variant="outline"
              icon={<Archive aria-hidden />}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Excluir</strong> apaga a turma e a lista de chamada
            dela. Os alunos continuam cadastrados no seu espaço. Não é possível desfazer.
          </p>
          <div>
            <ConfirmAction
              action={deleteClass.bind(null, turma.id)}
              label="Excluir turma"
              confirmLabel="Excluir definitivamente"
              question="Excluir esta turma?"
              icon={<Trash2 aria-hidden />}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
