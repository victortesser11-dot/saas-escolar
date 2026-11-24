import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import type { QuestionType } from "@/lib/questions/types";
import { isUuid } from "@/lib/uuid";

type ExamRow = Database["public"]["Tables"]["exams"]["Row"];

export type ExamListItem = {
  id: string;
  title: string;
  status: ExamRow["status"];
  questionCount: number;
  subjectName: string | null;
  classNames: string[];
  updatedAt: string;
};

export async function listExams(): Promise<ExamListItem[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exams")
    .select(
      "id, title, status, updated_at, subjects(name), exam_questions(count), exam_assignments(classes(name))",
    )
    .eq("workspace_id", user.workspace.id)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Falha ao listar provas: ${error.message}`);

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    updatedAt: row.updated_at,
    questionCount: row.exam_questions[0]?.count ?? 0,
    subjectName: row.subjects?.name ?? null,
    classNames: row.exam_assignments
      .map((a) => a.classes?.name)
      .filter((name): name is string => Boolean(name)),
  }));
}

export type ExamQuestionItem = {
  id: string;
  questionId: string;
  points: number;
  type: QuestionType;
  stem: string;
  optionCount: number;
};

export type ExamAssignmentItem = {
  id: string;
  classId: string;
  className: string;
  publicCode: string;
  accessCode: string | null;
  opensAt: string;
  closesAt: string;
  closedAt: string | null;
  /** Alunos que já começaram (com algum, a aplicação não pode ser removida). */
  attemptCount: number;
};

export type ExamDetail = {
  id: string;
  title: string;
  subject: { id: string; name: string } | null;
  description: string | null;
  instructions: string | null;
  status: ExamRow["status"];
  questionsPerAttempt: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  timeLimitMinutes: number | null;
  resultVisibility: ExamRow["result_visibility"];
  publishedAt: string | null;
  questions: ExamQuestionItem[];
  assignments: ExamAssignmentItem[];
};

type FrozenContent = { type: QuestionType; stem: string; options: { id: string; body: string }[] };

export async function getExamDetail(examId: string): Promise<ExamDetail> {
  if (!isUuid(examId)) notFound();
  await getCurrentUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("exams")
    .select(
      `id, title, subjects(id, name), description, instructions, status, questions_per_attempt, shuffle_questions,
       shuffle_options, time_limit_minutes, result_visibility, published_at,
       exam_questions(id, question_id, points, position, content,
         questions(type, stem, question_options(count))),
       exam_assignments(id, class_id, public_code, access_code, opens_at, closes_at, closed_at,
         classes(name), exam_attempts(count))`,
    )
    .eq("id", examId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar a prova: ${error.message}`);
  if (!data) notFound();

  const questions = [...data.exam_questions]
    .sort((a, b) => a.position - b.position)
    .map((eq) => {
      // Publicada: mostra a cópia congelada; rascunho: a questão atual do banco.
      const frozen = eq.content as FrozenContent | null;
      return {
        id: eq.id,
        questionId: eq.question_id,
        points: eq.points,
        type: frozen?.type ?? eq.questions!.type,
        stem: frozen?.stem ?? eq.questions!.stem,
        optionCount: frozen
          ? frozen.options.length
          : (eq.questions!.question_options[0]?.count ?? 0),
      };
    });

  const assignments = data.exam_assignments
    .map((a) => ({
      id: a.id,
      classId: a.class_id,
      className: a.classes?.name ?? "",
      publicCode: a.public_code,
      accessCode: a.access_code,
      opensAt: a.opens_at,
      closesAt: a.closes_at,
      closedAt: a.closed_at,
      attemptCount: a.exam_attempts[0]?.count ?? 0,
    }))
    .sort((a, b) => a.opensAt.localeCompare(b.opensAt));

  return {
    id: data.id,
    title: data.title,
    subject: data.subjects ?? null,
    description: data.description,
    instructions: data.instructions,
    status: data.status,
    questionsPerAttempt: data.questions_per_attempt,
    shuffleQuestions: data.shuffle_questions,
    shuffleOptions: data.shuffle_options,
    timeLimitMinutes: data.time_limit_minutes,
    resultVisibility: data.result_visibility,
    publishedAt: data.published_at,
    questions,
    assignments,
  };
}

/** Provas aplicadas em uma turma (para a página da turma). */
export async function listClassAssignments(classId: string) {
  if (!isUuid(classId)) return [];
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_assignments")
    .select("id, exam_id, opens_at, closes_at, closed_at, exams(title, subjects(id, name))")
    .eq("class_id", classId)
    .order("opens_at", { ascending: false });
  if (error) throw new Error(`Falha ao listar provas da turma: ${error.message}`);
  return data.map((a) => ({
    id: a.id,
    examId: a.exam_id,
    examTitle: a.exams?.title ?? "",
    subject: a.exams?.subjects ?? null,
    opensAt: a.opens_at,
    closesAt: a.closes_at,
    closedAt: a.closed_at,
  }));
}

/** Quantas provas publicadas usam a questão (aviso ao editar). */
export async function countPublishedExamsUsingQuestion(questionId: string): Promise<number> {
  if (!isUuid(questionId)) return 0;
  await getCurrentUser();
  const supabase = await createClient();
  const { count } = await supabase
    .from("exam_questions")
    .select("id, exams!inner(status)", { count: "exact", head: true })
    .eq("question_id", questionId)
    .eq("exams.status", "published");
  return count ?? 0;
}
