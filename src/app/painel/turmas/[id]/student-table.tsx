import Link from "next/link";
import { ConfirmAction } from "@/components/confirm-action";
import type { ClassRosterStudent } from "@/lib/classes/queries";
import { removeStudentFromClass } from "../../actions";

/** Lista de chamada: número na turma, nome (com a origem do cadastro) e remoção. */
export function StudentTable({
  classId,
  students,
  readOnly,
}: {
  classId: string;
  students: ClassRosterStudent[];
  readOnly: boolean;
}) {
  return (
    <div className="relative overflow-x-auto rounded-md border-[1.5px] border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-[1.5px] border-foreground text-left">
            <th
              scope="col"
              className="label-mono w-16 px-3 py-2.5 font-normal text-muted-foreground sm:px-4"
            >
              Nº
            </th>
            <th
              scope="col"
              className="label-mono px-3 py-2.5 font-normal text-muted-foreground sm:px-4"
            >
              Nome
            </th>
            {readOnly ? null : (
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Ações</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.id} className="border-b border-border last:border-b-0 hover:bg-paper">
              <td className="px-3 py-3 font-mono tabular-nums sm:px-4">
                {student.registrationCode}
              </td>
              <td className="px-3 py-3 sm:px-4">
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <Link
                    href={`/painel/alunos/${student.id}`}
                    className="font-medium underline decoration-transparent decoration-[3px] underline-offset-4 outline-none hover:decoration-mark focus-visible:decoration-mark"
                  >
                    {student.fullName}
                  </Link>
                  {student.joinedViaExam ? (
                    <span
                      className="label-mono rounded-sm border border-dashed border-foreground/40 px-1.5 py-0.5 text-[0.65rem] text-muted-foreground"
                      title="O próprio aluno se cadastrou ao entrar na prova. Confira o nome e o número."
                    >
                      entrou pela prova
                    </span>
                  ) : null}
                </span>
              </td>
              {readOnly ? null : (
                <td className="px-2 py-2 text-right sm:px-4">
                  <ConfirmAction
                    action={removeStudentFromClass.bind(null, classId, student.id)}
                    label="Remover"
                    confirmLabel="Remover da turma"
                    variant="ghost"
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
