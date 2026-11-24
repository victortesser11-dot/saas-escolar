"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { toFieldErrors } from "@/lib/auth/validation";
import { GENERIC_SAVE_ERROR } from "@/lib/classes/messages";
import {
  assignmentSchema,
  examInfoSchema,
  examRulesSchema,
  generateAccessCode,
} from "@/lib/exams/schema";
import type { FormState } from "@/lib/form-state";
import { parsePoints } from "@/lib/questions/points";
import { persistQuestion } from "@/lib/questions/persist";
import { MAX_IMPORT_QUESTIONS } from "@/lib/questions/csv";
import { questionSchema, toQuestionErrors, type QuestionInput } from "@/lib/questions/schema";
import { ensureSubjectId } from "@/lib/subjects/queries";
import { optionalSubjectSchema } from "@/lib/subjects/schema";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

/*
 * Ações de provas. Autorização pela RLS e pelas funções do banco; travas de prova
 * publicada garantidas por triggers (código 55000).
 */

const examPath = (id: string) => `/painel/provas/${id}`;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Mensagem amigável para erros do banco nas provas. */
function dbMessage(error: { code?: string; message: string } | null) {
  if (!error) return GENERIC_SAVE_ERROR;
  // 22023/55000: regras de negócio com mensagem pronta em português.
  if (error.code === "22023" || error.code === "55000") return error.message;
  return GENERIC_SAVE_ERROR;
}

// ---------------------------------------------------------------------------
// Prova
// ---------------------------------------------------------------------------

/** Disciplina digitada → id (criando se for nova). undefined = erro de validação. */
async function resolveSubject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  raw: string,
): Promise<{ id: string | null } | { error: string }> {
  const parsed = optionalSubjectSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_SAVE_ERROR };
  if (parsed.data === null) return { id: null };
  const id = await ensureSubjectId(supabase, workspaceId, parsed.data);
  return id ? { id } : { error: GENERIC_SAVE_ERROR };
}

export async function createExam(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    title: text(formData, "title"),
    subject: text(formData, "subject"),
    description: text(formData, "description"),
    instructions: text(formData, "instructions"),
  };
  const parsed = examInfoSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const user = await getCurrentUser();
  const supabase = await createClient();
  const subject = await resolveSubject(supabase, user.workspace.id, values.subject);
  if ("error" in subject)
    return { status: "error", fieldErrors: { subject: subject.error }, values };
  const { data, error } = await supabase
    .from("exams")
    .insert({
      workspace_id: user.workspace.id,
      owner_id: user.id,
      ...parsed.data,
      subject_id: subject.id,
    })
    .select("id")
    .single();
  if (error) return { status: "error", message: GENERIC_SAVE_ERROR, values };

  revalidatePath("/painel/provas");
  redirect(examPath(data.id));
}

export async function updateExamInfo(
  examId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = {
    title: text(formData, "title"),
    subject: text(formData, "subject"),
    description: text(formData, "description"),
    instructions: text(formData, "instructions"),
  };
  const parsed = examInfoSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };
  if (!isUuid(examId)) return { status: "error", message: GENERIC_SAVE_ERROR, values };

  const user = await getCurrentUser();
  const supabase = await createClient();
  const subject = await resolveSubject(supabase, user.workspace.id, values.subject);
  if ("error" in subject)
    return { status: "error", fieldErrors: { subject: subject.error }, values };
  const { error } = await supabase
    .from("exams")
    .update({ ...parsed.data, subject_id: subject.id })
    .eq("id", examId);
  if (error) return { status: "error", message: dbMessage(error), values };

  revalidatePath("/painel/provas");
  redirect(examPath(examId));
}

export type RulesInput = {
  drawMode: "all" | "some";
  questionsPerAttempt: string;
  timeMode: "none" | "limit";
  timeLimitMinutes: string;
  resultVisibility: "score_only" | "score_and_key";
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
};

export async function updateExamRules(
  examId: string,
  input: RulesInput,
): Promise<{ status: "error" | "success"; message?: string; errors?: Record<string, string> }> {
  const parsed = examRulesSchema.safeParse(input);
  if (!parsed.success) return { status: "error", errors: toQuestionErrors(parsed.error) };
  if (!isUuid(examId)) return { status: "error", message: GENERIC_SAVE_ERROR };

  const supabase = await createClient();
  const { error } = await supabase
    .from("exams")
    .update({
      questions_per_attempt: parsed.data.questionsPerAttempt,
      time_limit_minutes: parsed.data.timeLimitMinutes,
      result_visibility: parsed.data.resultVisibility,
      shuffle_questions: parsed.data.shuffleQuestions,
      shuffle_options: parsed.data.shuffleOptions,
    })
    .eq("id", examId);
  if (error) return { status: "error", message: dbMessage(error) };

  refresh();
  return { status: "success", message: "Regras salvas." };
}

export async function deleteExam(examId: string): Promise<void> {
  if (!isUuid(examId)) return;
  const supabase = await createClient();
  await supabase.from("exams").delete().eq("id", examId);
  revalidatePath("/painel/provas");
  redirect("/painel/provas");
}

// ---------------------------------------------------------------------------
// Questões da prova
// ---------------------------------------------------------------------------

/** Escreve uma questão dentro da prova: grava no banco e adiciona à prova. */
export async function saveQuestionToExam(
  examId: string,
  input: QuestionInput,
  next: "list" | "new",
): Promise<{ status: "error"; message?: string; errors: Record<string, string> }> {
  if (!isUuid(examId)) return { status: "error", message: GENERIC_SAVE_ERROR, errors: {} };
  const result = await persistQuestion(null, input);
  if (!result.ok) return { status: "error", message: result.message, errors: result.errors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_questions_to_exam", {
    p_exam_id: examId,
    p_question_ids: [result.id],
  });
  if (error) return { status: "error", message: dbMessage(error), errors: {} };

  revalidatePath(examPath(examId));
  revalidatePath("/painel/questoes");
  redirect(
    next === "new"
      ? `${examPath(examId)}/questoes/nova?tipo=${result.type}&salva=${Date.now()}`
      : examPath(examId),
  );
}

export type ImportQuestionsResult =
  { status: "success"; count: number } | { status: "error"; message: string };

/**
 * Importa as questões lidas da planilha (já conferidas no navegador; validadas de novo
 * aqui). Todas entram numa única transação no banco: ou todas, ou nenhuma.
 */
export async function importQuestionsToExam(
  examId: string,
  inputs: QuestionInput[],
): Promise<ImportQuestionsResult> {
  if (!isUuid(examId) || !Array.isArray(inputs)) {
    return { status: "error", message: GENERIC_SAVE_ERROR };
  }
  if (inputs.length === 0) return { status: "error", message: "Nenhuma questão para importar." };
  if (inputs.length > MAX_IMPORT_QUESTIONS) {
    return {
      status: "error",
      message: `Importe no máximo ${MAX_IMPORT_QUESTIONS} questões por vez.`,
    };
  }

  const questions = [];
  for (const input of inputs) {
    const parsed = questionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: "error",
        message: "A planilha tem dados inválidos. Revise e envie de novo.",
      };
    }
    const q = parsed.data;
    questions.push({
      type: q.type,
      stem: q.stem,
      explanation: q.explanation,
      points: q.points,
      tags: q.tags,
      options: q.options.map((o) => ({ body: o.body, is_correct: o.isCorrect })),
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_exam_questions", {
    p_exam_id: examId,
    p_questions: questions,
  });
  if (error) return { status: "error", message: dbMessage(error) };

  revalidatePath(examPath(examId));
  revalidatePath("/painel/questoes");
  return { status: "success", count: data ?? questions.length };
}

export async function addQuestionsFromBank(examId: string, formData: FormData): Promise<void> {
  if (!isUuid(examId)) return;
  const ids = formData.getAll("questionIds").filter(isUuid);
  if (ids.length > 0) {
    const supabase = await createClient();
    await supabase.rpc("add_questions_to_exam", { p_exam_id: examId, p_question_ids: ids });
  }
  revalidatePath(examPath(examId));
  redirect(examPath(examId));
}

export async function setExamQuestionPoints(
  examQuestionId: string,
  rawPoints: string,
): Promise<{ ok: boolean; message?: string }> {
  const points = parsePoints(rawPoints);
  if (points === null) return { ok: false, message: "Valor inválido. Use, por exemplo, 1 ou 1,5." };
  if (!isUuid(examQuestionId)) return { ok: false, message: GENERIC_SAVE_ERROR };

  const supabase = await createClient();
  const { error } = await supabase
    .from("exam_questions")
    .update({ points })
    .eq("id", examQuestionId);
  if (error) return { ok: false, message: dbMessage(error) };
  refresh();
  return { ok: true };
}

export async function moveExamQuestion(examQuestionId: string, direction: -1 | 1): Promise<void> {
  if (!isUuid(examQuestionId)) return;
  const supabase = await createClient();
  await supabase.rpc("move_exam_question", {
    p_exam_question_id: examQuestionId,
    p_direction: direction,
  });
  refresh();
}

export async function removeExamQuestion(examQuestionId: string): Promise<void> {
  if (!isUuid(examQuestionId)) return;
  const supabase = await createClient();
  await supabase.from("exam_questions").delete().eq("id", examQuestionId);
  refresh();
}

// ---------------------------------------------------------------------------
// Publicação
// ---------------------------------------------------------------------------

export async function publishExam(examId: string): Promise<{ message: string } | void> {
  if (!isUuid(examId)) return { message: GENERIC_SAVE_ERROR };
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_exam", { p_exam_id: examId });
  if (error) return { message: dbMessage(error) };
  revalidatePath("/painel/provas");
  redirect(`${examPath(examId)}?publicada=1`);
}

export async function unpublishExam(examId: string): Promise<void> {
  if (!isUuid(examId)) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("unpublish_exam", { p_exam_id: examId });
  revalidatePath("/painel/provas");
  redirect(error ? `${examPath(examId)}?erro=despublicar` : examPath(examId));
}

// ---------------------------------------------------------------------------
// Aplicação em turmas
// ---------------------------------------------------------------------------

/** O que o formulário de aplicação envia: a turma OU a prova escolhida, conforme a tela. */
export type ApplyInput = {
  targetId: string;
  opensAt: string;
  closesAt: string;
  requireAccessCode: boolean;
};

type ApplyResult = { status: "error"; message?: string; errors: Record<string, string> };

/** Núcleo comum: aplica a prova na turma e leva à prova, onde ficam o link e o código. */
async function applyExamToClass(
  examId: string,
  classId: string,
  input: ApplyInput,
  duplicateMessage: string,
): Promise<ApplyResult> {
  const parsed = assignmentSchema.safeParse({ ...input, classId });
  if (!parsed.success) return { status: "error", errors: toQuestionErrors(parsed.error) };
  if (!isUuid(examId)) {
    return { status: "error", errors: { targetId: "Escolha a prova." } };
  }

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("exam_assignments").insert({
    workspace_id: user.workspace.id,
    exam_id: examId,
    class_id: parsed.data.classId,
    opens_at: parsed.data.opensAt,
    closes_at: parsed.data.closesAt,
    access_code: parsed.data.requireAccessCode ? generateAccessCode() : null,
  });

  if (error?.code === "23505") {
    return { status: "error", errors: { targetId: duplicateMessage } };
  }
  if (error) return { status: "error", message: dbMessage(error), errors: {} };

  revalidatePath(examPath(examId));
  revalidatePath(`/painel/turmas/${parsed.data.classId}`);
  redirect(`${examPath(examId)}?aplicada=1`);
}

/** A partir da prova: o professor escolhe a turma. */
export async function createAssignment(examId: string, input: ApplyInput): Promise<ApplyResult> {
  return applyExamToClass(
    examId,
    input.targetId,
    input,
    "Esta prova já foi aplicada nesta turma. Ajuste o período dela na prova.",
  );
}

/** A partir da turma: o professor escolhe a prova. */
export async function createAssignmentForClass(
  classId: string,
  input: ApplyInput,
): Promise<ApplyResult> {
  return applyExamToClass(
    input.targetId,
    classId,
    input,
    "Esta prova já foi aplicada nesta turma. Veja o link dela na página da prova.",
  );
}

export async function closeAssignmentNow(assignmentId: string): Promise<void> {
  if (!isUuid(assignmentId)) return;
  const supabase = await createClient();
  await supabase
    .from("exam_assignments")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", assignmentId);
  refresh();
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  if (!isUuid(assignmentId)) return;
  const supabase = await createClient();
  // A RLS só permite remover aplicações em que nenhum aluno começou a prova.
  await supabase.from("exam_assignments").delete().eq("id", assignmentId);
  refresh();
}
