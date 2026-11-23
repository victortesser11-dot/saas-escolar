import { Trash2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { PageHeader } from "@/components/page-header";
import { getStudentDetail } from "@/lib/classes/queries";
import { deleteStudent, updateStudent } from "../../actions";
import { StudentForm } from "./student-form";

export default function StudentPage({ params }: PageProps<"/painel/alunos/[id]">) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted" />}>
      <StudentContent params={params} />
    </Suspense>
  );
}

async function StudentContent({ params }: Pick<PageProps<"/painel/alunos/[id]">, "params">) {
  const { id } = await params;
  const student = await getStudentDetail(id);
  const firstClass = student.classes.find((c) => !c.archived) ?? student.classes[0];

  return (
    <div className="grid gap-10">
      <title>{`${student.fullName} · Avaliações Escolares`}</title>
      <PageHeader
        back={
          firstClass
            ? { href: `/painel/turmas/${firstClass.id}`, label: firstClass.name }
            : { href: "/painel", label: "Turmas" }
        }
        eyebrow={`Nº ${student.registrationCode}`}
        title={student.fullName}
      />

      <section aria-labelledby="turmas-aluno" className="grid gap-3">
        <h2 id="turmas-aluno" className="text-lg font-semibold">
          Turmas
        </h2>
        {student.classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este aluno não está em nenhuma turma.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {student.classes.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/painel/turmas/${c.id}`}
                  className="inline-flex items-center gap-2 rounded-md border-[1.5px] border-border bg-card px-3 py-1.5 text-sm outline-none hover:border-foreground focus-visible:ring-4 focus-visible:ring-ring"
                >
                  {c.name}
                  {c.schoolYear ? (
                    <span className="font-mono text-xs text-muted-foreground">{c.schoolYear}</span>
                  ) : null}
                  {c.archived ? (
                    <span className="label-mono text-muted-foreground">arquivada</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">
          O histórico de provas do aluno aparecerá aqui quando as provas estiverem disponíveis.
        </p>
      </section>

      <section aria-labelledby="dados-aluno" className="grid gap-4">
        <h2 id="dados-aluno" className="text-lg font-semibold">
          Dados do aluno
        </h2>
        <StudentForm
          action={updateStudent.bind(null, student.id)}
          defaults={{ fullName: student.fullName, registrationCode: student.registrationCode }}
        />
      </section>

      <section
        aria-labelledby="excluir-aluno"
        className="grid max-w-2xl gap-3 border-t-[1.5px] border-dashed border-border pt-8"
      >
        <h2 id="excluir-aluno" className="text-lg font-semibold">
          Excluir aluno
        </h2>
        <p className="text-sm text-muted-foreground">
          Remove o aluno do seu espaço e de todas as turmas. Para tirá-lo de uma turma só, use
          &quot;Remover&quot; na lista da turma. Não é possível desfazer.
        </p>
        <div>
          <ConfirmAction
            action={deleteStudent.bind(null, student.id)}
            label="Excluir aluno"
            confirmLabel="Excluir definitivamente"
            question="Excluir este aluno?"
            icon={<Trash2 aria-hidden />}
          />
        </div>
      </section>
    </div>
  );
}
