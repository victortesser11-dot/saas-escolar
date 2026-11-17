import Link from "next/link";
import { ConfirmAction } from "@/components/confirm-action";
import type { ClassStudent } from "@/lib/classes/queries";
import { removeStudentFromClass } from "../../actions";

/** Lista de chamada: número, nome, matrícula e remoção da turma. */
export function StudentTable({
  classId,
  students,
  readOnly,
}: {
  classId: string;
  students: ClassStudent[];
  readOnly: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-md border-[1.5px] border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-[1.5px] border-foreground text-left">
            <th
              scope="col"
              className="label-mono hidden w-14 px-4 py-2.5 font-normal text-muted-foreground sm:table-cell"
            >
              Nº
            </th>
            <th scope="col" className="label-mono px-4 py-2.5 font-normal text-muted-foreground">
              Nome
            </th>
            <th scope="col" className="label-mono px-4 py-2.5 font-normal text-muted-foreground">
              Matrícula
            </th>
            {readOnly ? null : (
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Ações</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {students.map((student, index) => (
            <tr key={student.id} className="border-b border-border last:border-b-0 hover:bg-paper">
              <td className="hidden px-4 py-3 font-mono text-muted-foreground tabular-nums sm:table-cell">
                {String(index + 1).padStart(2, "0")}
              </td>
              <td className="px-3 py-3 sm:px-4">
                <Link
                  href={`/painel/alunos/${student.id}`}
                  className="font-medium underline decoration-transparent decoration-[3px] underline-offset-4 outline-none hover:decoration-mark focus-visible:decoration-mark"
                >
                  {student.fullName}
                </Link>
              </td>
              <td className="px-3 py-3 font-mono tabular-nums sm:px-4">
                {student.registrationCode}
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
