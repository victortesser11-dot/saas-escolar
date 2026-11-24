import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { compareRoll } from "@/lib/students/roll-order";
import { isUuid } from "@/lib/uuid";

/*
 * Consultas de turmas e alunos. Sempre executadas com a sessão do professor (RLS),
 * a partir de getCurrentUser, que também adia a execução para o momento da requisição.
 */

export type ClassSummary = {
  id: string;
  name: string;
  schoolYear: number | null;
  archivedAt: string | null;
  selfEnroll: boolean;
  studentCount: number;
};

export type ClassStudent = {
  id: string;
  fullName: string;
  /** Número na turma; null quando o aluno não informou. */
  registrationCode: string | null;
};

export type ClassRosterStudent = ClassStudent & {
  /** Entrou sozinho pela prova (autocadastro), e não pelo professor. */
  joinedViaExam: boolean;
};

export type ClassDetail = Omit<ClassSummary, "studentCount"> & {
  selfEnroll: boolean;
  subjects: { id: string; name: string }[];
  students: ClassRosterStudent[];
};

/** Ordem de chamada: pelo número (1, 2, 10…), depois pelo nome. */
export function byRollNumber(a: ClassStudent, b: ClassStudent) {
  return compareRoll(
    { code: a.registrationCode, name: a.fullName },
    { code: b.registrationCode, name: b.fullName },
  );
}

export type StudentDetail = ClassStudent & {
  classes: { id: string; name: string; schoolYear: number | null; archived: boolean }[];
};

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

export async function listClasses({ archived }: { archived: boolean }): Promise<ClassSummary[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  let query = supabase
    .from("classes")
    .select("id, name, school_year, archived_at, self_enroll, class_students(count)")
    .eq("workspace_id", user.workspace.id);
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);

  const { data, error } = await query;
  if (error) throw new Error(`Falha ao listar turmas: ${error.message}`);

  return data
    .map((row) => ({
      id: row.id,
      name: row.name,
      schoolYear: row.school_year,
      archivedAt: row.archived_at,
      selfEnroll: row.self_enroll,
      studentCount: row.class_students[0]?.count ?? 0,
    }))
    .sort((a, b) => (b.schoolYear ?? 0) - (a.schoolYear ?? 0) || collator.compare(a.name, b.name));
}

export async function countArchivedClasses(): Promise<number> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", user.workspace.id)
    .not("archived_at", "is", null);
  if (error) throw new Error(`Falha ao contar turmas arquivadas: ${error.message}`);
  return count ?? 0;
}

/** Turma com seus alunos (ordem alfabética). 404 se não existir ou não for do professor. */
export async function getClassDetail(classId: string): Promise<ClassDetail> {
  if (!isUuid(classId)) notFound();
  await getCurrentUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .select(
      "id, name, school_year, archived_at, self_enroll, class_subjects(subjects(id, name)), class_students(joined_via, students(id, full_name, registration_code))",
    )
    .eq("id", classId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar a turma: ${error.message}`);
  if (!data) notFound();

  const students = data.class_students
    .flatMap(({ students: s, joined_via }) =>
      s
        ? [
            {
              id: s.id,
              fullName: s.full_name,
              registrationCode: s.registration_code,
              joinedViaExam: joined_via === "exam",
            },
          ]
        : [],
    )
    .sort(byRollNumber);

  const subjects = data.class_subjects
    .flatMap(({ subjects: s }) => (s ? [{ id: s.id, name: s.name }] : []))
    .sort((a, b) => collator.compare(a.name, b.name));

  return {
    id: data.id,
    name: data.name,
    schoolYear: data.school_year,
    archivedAt: data.archived_at,
    selfEnroll: data.self_enroll,
    subjects,
    students,
  };
}

export async function getStudentDetail(studentId: string): Promise<StudentDetail> {
  if (!isUuid(studentId)) notFound();
  await getCurrentUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .select(
      "id, full_name, registration_code, class_students(classes(id, name, school_year, archived_at))",
    )
    .eq("id", studentId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar o aluno: ${error.message}`);
  if (!data) notFound();

  return {
    id: data.id,
    fullName: data.full_name,
    registrationCode: data.registration_code,
    classes: data.class_students
      .map(({ classes: c }) => c)
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map((c) => ({
        id: c.id,
        name: c.name,
        schoolYear: c.school_year,
        archived: c.archived_at !== null,
      }))
      .sort((a, b) => collator.compare(a.name, b.name)),
  };
}
