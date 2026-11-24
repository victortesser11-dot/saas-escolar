"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { toFieldErrors } from "@/lib/auth/validation";
import {
  describeImport,
  GENERIC_SAVE_ERROR,
  isUniqueViolation,
  toImportSummary,
  type ImportSummary,
} from "@/lib/classes/messages";
import type { FormState } from "@/lib/form-state";
import { MAX_IMPORT_ROWS } from "@/lib/students/csv";
import { classSchema, studentSchema } from "@/lib/students/validation";
import { linkSubjectsToClass } from "@/lib/subjects/queries";
import { parseSubjectList, subjectNameSchema } from "@/lib/subjects/schema";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

/*
 * Ações de turmas e alunos. A autorização real é feita pela RLS do banco
 * (o cliente usa a sessão do professor); aqui validamos entrada e montamos mensagens.
 */

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const classPath = (id: string) => `/painel/turmas/${id}`;

// ---------------------------------------------------------------------------
// Turmas
// ---------------------------------------------------------------------------

export async function createClass(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    name: text(formData, "name"),
    schoolYear: text(formData, "schoolYear"),
    subjects: text(formData, "subjects"),
  };
  const parsed = classSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };
  const subjects = parseSubjectList(values.subjects);
  if (subjects.error) return { status: "error", fieldErrors: { subjects: subjects.error }, values };

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .insert({
      workspace_id: user.workspace.id,
      teacher_id: user.id,
      name: parsed.data.name,
      school_year: parsed.data.schoolYear,
    })
    .select("id")
    .single();

  if (error) return { status: "error", message: GENERIC_SAVE_ERROR, values };
  // A turma já existe: se falhar aqui, o professor inclui as disciplinas na página dela.
  await linkSubjectsToClass(supabase, user.workspace.id, data.id, subjects.names);

  revalidatePath("/painel", "layout");
  redirect(classPath(data.id));
}

// ---------------------------------------------------------------------------
// Disciplinas e autocadastro da turma
// ---------------------------------------------------------------------------

export async function addSubjectToClass(
  classId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = { subject: text(formData, "subject") };
  const parsed = subjectNameSchema.safeParse(values.subject);
  if (!parsed.success) {
    return { status: "error", fieldErrors: { subject: parsed.error.issues[0]?.message }, values };
  }
  if (!isUuid(classId)) return { status: "error", message: GENERIC_SAVE_ERROR, values };

  const user = await getCurrentUser();
  const supabase = await createClient();
  const ok = await linkSubjectsToClass(supabase, user.workspace.id, classId, [parsed.data]);
  if (!ok) return { status: "error", message: GENERIC_SAVE_ERROR, values };

  refresh();
  return { status: "success", message: `${parsed.data} incluída na turma.` };
}

export async function removeSubjectFromClass(classId: string, subjectId: string): Promise<void> {
  if (!isUuid(classId) || !isUuid(subjectId)) return;
  const supabase = await createClient();
  await supabase
    .from("class_subjects")
    .delete()
    .eq("class_id", classId)
    .eq("subject_id", subjectId);
  refresh();
}

export async function setClassSelfEnroll(classId: string, enabled: boolean): Promise<void> {
  if (!isUuid(classId)) return;
  const supabase = await createClient();
  await supabase.from("classes").update({ self_enroll: enabled }).eq("id", classId);
  refresh();
}

export async function updateClass(
  classId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = { name: text(formData, "name"), schoolYear: text(formData, "schoolYear") };
  const parsed = classSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };
  if (!isUuid(classId)) return { status: "error", message: GENERIC_SAVE_ERROR, values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .update({ name: parsed.data.name, school_year: parsed.data.schoolYear })
    .eq("id", classId)
    .select("id");

  if (error || data.length === 0) return { status: "error", message: GENERIC_SAVE_ERROR, values };

  revalidatePath("/painel", "layout");
  redirect(classPath(classId));
}

export async function setClassArchived(classId: string, archived: boolean): Promise<void> {
  if (!isUuid(classId)) return;
  const supabase = await createClient();
  await supabase
    .from("classes")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", classId);

  revalidatePath("/painel", "layout");
  redirect(archived ? "/painel" : classPath(classId));
}

export async function deleteClass(classId: string): Promise<void> {
  if (!isUuid(classId)) return;
  const supabase = await createClient();
  // Remove só a turma e os vínculos; os alunos continuam cadastrados no espaço.
  const { error } = await supabase.from("classes").delete().eq("id", classId);
  if (error?.code === "23503") {
    // Turma com prova aplicada: o banco impede a exclusão (deve ser arquivada).
    redirect(`${classPath(classId)}/editar?erro=com-provas`);
  }

  revalidatePath("/painel", "layout");
  redirect("/painel");
}

// ---------------------------------------------------------------------------
// Alunos na turma
// ---------------------------------------------------------------------------

/**
 * Adiciona um aluno à turma (mesma regra da importação, função import_students):
 * o número é único na turma.
 */
export async function addStudentToClass(
  classId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = {
    fullName: text(formData, "fullName"),
    registrationCode: text(formData, "registrationCode"),
  };
  const parsed = studentSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };
  if (!isUuid(classId)) return { status: "error", message: GENERIC_SAVE_ERROR, values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_students", {
    p_class_id: classId,
    p_students: [
      { full_name: parsed.data.fullName, registration_code: parsed.data.registrationCode },
    ],
  });
  if (error) return { status: "error", message: GENERIC_SAVE_ERROR, values };

  const summary = toImportSummary(data);
  if (summary.alreadyInClass > 0) {
    return {
      status: "error",
      fieldErrors: parsed.data.registrationCode
        ? { registrationCode: `O número ${parsed.data.registrationCode} já está nesta turma.` }
        : { fullName: `${parsed.data.fullName} já está nesta turma (sem número).` },
      values,
    };
  }

  refresh();
  return {
    status: "success",
    message: `${parsed.data.fullName} foi adicionado(a) à turma.`,
  };
}

export async function removeStudentFromClass(classId: string, studentId: string): Promise<void> {
  if (!isUuid(classId) || !isUuid(studentId)) return;
  const supabase = await createClient();
  await supabase
    .from("class_students")
    .delete()
    .eq("class_id", classId)
    .eq("student_id", studentId);
  refresh();
}

export type ImportResult =
  | { status: "success"; summary: ImportSummary; message: string }
  | { status: "error"; message: string };

/** Importa as linhas já validadas no navegador. Valida de novo aqui: nunca confiar no cliente. */
export async function importStudents(
  classId: string,
  rows: { fullName: string; registrationCode: string | null }[],
): Promise<ImportResult> {
  if (!isUuid(classId) || !Array.isArray(rows)) {
    return { status: "error", message: GENERIC_SAVE_ERROR };
  }
  if (rows.length === 0) return { status: "error", message: "Nenhum aluno para importar." };
  if (rows.length > MAX_IMPORT_ROWS) {
    return { status: "error", message: `Importe no máximo ${MAX_IMPORT_ROWS} alunos por vez.` };
  }

  const students = [];
  for (const row of rows) {
    const parsed = studentSchema.safeParse(row);
    if (!parsed.success) {
      return {
        status: "error",
        message: "A planilha tem dados inválidos. Revise e tente de novo.",
      };
    }
    students.push({
      full_name: parsed.data.fullName,
      registration_code: parsed.data.registrationCode,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_students", {
    p_class_id: classId,
    p_students: students,
  });
  if (error) return { status: "error", message: GENERIC_SAVE_ERROR };

  const summary = toImportSummary(data);
  revalidatePath(classPath(classId));
  return { status: "success", summary, message: describeImport(summary) };
}

// ---------------------------------------------------------------------------
// Aluno
// ---------------------------------------------------------------------------

export async function updateStudent(
  studentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = {
    fullName: text(formData, "fullName"),
    registrationCode: text(formData, "registrationCode"),
  };
  const parsed = studentSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };
  if (!isUuid(studentId)) return { status: "error", message: GENERIC_SAVE_ERROR, values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .update({ full_name: parsed.data.fullName, registration_code: parsed.data.registrationCode })
    .eq("id", studentId)
    .select("id");

  if (isUniqueViolation(error)) {
    return {
      status: "error",
      fieldErrors: { registrationCode: "Já existe outro aluno com esse número na turma." },
      values,
    };
  }
  if (error || data?.length === 0) return { status: "error", message: GENERIC_SAVE_ERROR, values };

  refresh();
  return { status: "success", message: "Dados do aluno atualizados.", values };
}

export async function deleteStudent(studentId: string): Promise<void> {
  if (!isUuid(studentId)) return;
  const supabase = await createClient();
  await supabase.from("students").delete().eq("id", studentId);
  revalidatePath("/painel", "layout");
  redirect("/painel");
}
