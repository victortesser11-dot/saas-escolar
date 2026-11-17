import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import type { QuestionType } from "@/lib/questions/types";
import { isUuid } from "@/lib/uuid";
import { percentOf, situationOf, type Situation } from "./stats";

/*
 * Consultas de resultados para o professor (sempre sob RLS). Os volumes por turma
 * são pequenos (dezenas de alunos), então os indicadores são calculados aqui.
 */

type AttemptStatus = Database["public"]["Enums"]["attempt_status"];
type GradingStatus = Database["public"]["Enums"]["grading_status"];

type AttemptRow = {
  id: string;
  student_id: string;
  assignment_id: string;
  attempt_number: number;
  status: AttemptStatus;
  started_at: string;
  expires_at: string;
  finalized_at: string | null;
  finalize_reason: string | null;
  max_score: number | null;
  auto_score: number | null;
  final_score: number | null;
  grading_status: GradingStatus | null;
};

const ATTEMPT_COLUMNS =
  "id, student_id, assignment_id, attempt_number, status, started_at, expires_at, finalized_at, finalize_reason, max_score, auto_score, final_score, grading_status";

/** Última tentativa de cada aluno (as substituídas ficam só no histórico). */
function latestByStudent(rows: AttemptRow[]) {
  const latest = new Map<string, AttemptRow>();
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.student_id, (counts.get(row.student_id) ?? 0) + 1);
    const current = latest.get(row.student_id);
    if (!current || row.attempt_number > current.attempt_number) latest.set(row.student_id, row);
  }
  return { latest, counts };
}

/** Nota exibida: final quando corrigida; parcial (automática) quando há pendência. */
function scoreOf(row: AttemptRow) {
  const finalized = row.status === "submitted" || row.status === "expired";
  if (!finalized) return { score: null, percent: null, partial: false };
  const score = row.final_score ?? row.auto_score;
  return {
    score,
    percent: percentOf(score, row.max_score),
    partial: row.grading_status === "pending_review",
  };
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

// ---------------------------------------------------------------------------
// Aplicação de uma prova em uma turma
// ---------------------------------------------------------------------------

export type StudentRow = {
  studentId: string;
  fullName: string;
  registrationCode: string;
  situation: Situation;
  attemptId: string | null;
  attemptCount: number;
  score: number | null;
  maxScore: number | null;
  percent: number | null;
  partial: boolean;
  startedAt: string | null;
  finalizedAt: string | null;
  pendingRelease: "resume" | "new_attempt" | null;
};

export type QuestionStat = {
  examQuestionId: string;
  position: number;
  type: QuestionType;
  stem: string;
  points: number;
  answered: number;
  correct: number;
  pending: number;
  /** % de acerto (pontos obtidos / possíveis) entre quem recebeu a questão. */
  percent: number | null;
};

export async function getAssignmentReport(assignmentId: string) {
  if (!isUuid(assignmentId)) notFound();
  await getCurrentUser();
  const supabase = await createClient();

  const { data: assignment, error } = await supabase
    .from("exam_assignments")
    .select(
      "id, exam_id, class_id, public_code, access_code, opens_at, closes_at, closed_at, exams(title, time_limit_minutes), classes(name)",
    )
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar a aplicação: ${error.message}`);
  if (!assignment) notFound();

  const [rosterResult, attemptsResult, releasesResult, questionsResult] = await Promise.all([
    supabase
      .from("class_students")
      .select("students(id, full_name, registration_code)")
      .eq("class_id", assignment.class_id),
    supabase.from("exam_attempts").select(ATTEMPT_COLUMNS).eq("assignment_id", assignmentId),
    supabase
      .from("attempt_releases")
      .select("student_id, kind")
      .eq("assignment_id", assignmentId)
      .is("consumed_at", null),
    supabase
      .from("exam_questions")
      .select("id, position, points, content")
      .eq("exam_id", assignment.exam_id)
      .order("position"),
  ]);
  for (const result of [rosterResult, attemptsResult, releasesResult, questionsResult]) {
    if (result.error) throw new Error(`Falha ao carregar resultados: ${result.error.message}`);
  }

  const now = new Date();
  const closesAt = new Date(assignment.closed_at ?? assignment.closes_at);
  const closed = closesAt <= now || new Date(assignment.closes_at) <= now;
  const { latest, counts } = latestByStudent((attemptsResult.data ?? []) as AttemptRow[]);
  const releases = new Map(
    (releasesResult.data ?? []).map((r) => [r.student_id, r.kind as "resume" | "new_attempt"]),
  );

  const students: StudentRow[] = (rosterResult.data ?? [])
    .map(({ students: s }) => s)
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map((s) => {
      const attempt = latest.get(s.id) ?? null;
      const result = attempt ? scoreOf(attempt) : { score: null, percent: null, partial: false };
      return {
        studentId: s.id,
        fullName: s.full_name,
        registrationCode: s.registration_code,
        situation: situationOf(
          attempt ? { status: attempt.status, gradingStatus: attempt.grading_status } : null,
          closed,
        ),
        attemptId: attempt?.id ?? null,
        attemptCount: counts.get(s.id) ?? 0,
        score: result.score,
        maxScore: attempt?.max_score ?? null,
        percent: result.percent,
        partial: result.partial,
        startedAt: attempt?.started_at ?? null,
        finalizedAt: attempt?.finalized_at ?? null,
        pendingRelease: releases.get(s.id) ?? null,
      };
    })
    .sort((a, b) => collator.compare(a.fullName, b.fullName));

  // Análise por questão, só com aplicações finalizadas (últimas tentativas).
  const finalizedIds = [...latest.values()]
    .filter((a) => a.status === "submitted" || a.status === "expired")
    .map((a) => a.id);

  const stats = new Map<
    string,
    { answered: number; correct: number; pending: number; got: number; possible: number }
  >();
  if (finalizedIds.length > 0) {
    const { data: answers, error: answersError } = await supabase
      .from("student_answers")
      .select(
        "is_correct, points_awarded, needs_review, selected_option_ids, text_answer, attempt_questions(exam_question_id, points)",
      )
      .in("attempt_id", finalizedIds);
    if (answersError) throw new Error(`Falha ao carregar respostas: ${answersError.message}`);
    for (const a of answers ?? []) {
      const key = a.attempt_questions?.exam_question_id;
      if (!key) continue;
      const entry = stats.get(key) ?? { answered: 0, correct: 0, pending: 0, got: 0, possible: 0 };
      const hasAnswer =
        (a.selected_option_ids?.length ?? 0) > 0 || (a.text_answer ?? "").trim() !== "";
      if (hasAnswer) entry.answered += 1;
      if (a.needs_review) {
        entry.pending += 1;
      } else {
        if (a.is_correct) entry.correct += 1;
        entry.got += a.points_awarded ?? 0;
        entry.possible += a.attempt_questions?.points ?? 0;
      }
      stats.set(key, entry);
    }
  }

  type Frozen = { type: QuestionType; stem: string };
  const questions: QuestionStat[] = (questionsResult.data ?? []).map((q, index) => {
    const content = q.content as Frozen | null;
    const s = stats.get(q.id);
    return {
      examQuestionId: q.id,
      position: index + 1,
      type: content?.type ?? "single_choice",
      stem: content?.stem ?? "",
      points: q.points,
      answered: s?.answered ?? 0,
      correct: s?.correct ?? 0,
      pending: s?.pending ?? 0,
      percent: s && s.possible > 0 ? Math.round((s.got / s.possible) * 1000) / 10 : null,
    };
  });

  return {
    assignment: {
      id: assignment.id,
      examId: assignment.exam_id,
      classId: assignment.class_id,
      examTitle: assignment.exams?.title ?? "",
      className: assignment.classes?.name ?? "",
      publicCode: assignment.public_code,
      accessCode: assignment.access_code,
      opensAt: assignment.opens_at,
      closesAt: assignment.closes_at,
      closedAt: assignment.closed_at,
      timeLimitMinutes: assignment.exams?.time_limit_minutes ?? null,
      closed,
    },
    students,
    questions,
  };
}

// ---------------------------------------------------------------------------
// Respostas de um aluno
// ---------------------------------------------------------------------------

export type AttemptAnswer = {
  attemptQuestionId: string;
  answerId: string | null;
  position: number;
  type: QuestionType;
  stem: string;
  points: number;
  options: { id: string; body: string; correct: boolean; chosen: boolean }[];
  textAnswer: string | null;
  accepted: string[];
  explanation: string | null;
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  needsReview: boolean;
  gradedAt: string | null;
};

export async function getAttemptDetail(attemptId: string) {
  if (!isUuid(attemptId)) notFound();
  await getCurrentUser();
  const supabase = await createClient();

  const { data: attempt, error } = await supabase
    .from("exam_attempts")
    .select(`${ATTEMPT_COLUMNS}, students(full_name, registration_code)`)
    .eq("id", attemptId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar a aplicação: ${error.message}`);
  if (!attempt) notFound();

  const [questionsResult, answersResult, eventsResult, pendingResult] = await Promise.all([
    supabase
      .from("attempt_questions")
      .select("id, position, points, option_order, exam_questions(content, answer_key)")
      .eq("attempt_id", attemptId)
      .order("position"),
    supabase
      .from("student_answers")
      .select(
        "id, attempt_question_id, selected_option_ids, text_answer, is_correct, points_awarded, needs_review, graded_at",
      )
      .eq("attempt_id", attemptId),
    supabase
      .from("exam_events")
      .select("id, type, actor, created_at, payload")
      .eq("assignment_id", attempt.assignment_id)
      .eq("student_id", attempt.student_id)
      .order("created_at"),
    supabase
      .from("exam_attempts")
      .select("id, students(full_name)")
      .eq("assignment_id", attempt.assignment_id)
      .eq("grading_status", "pending_review")
      .neq("id", attemptId),
  ]);
  for (const result of [questionsResult, answersResult, eventsResult, pendingResult]) {
    if (result.error) throw new Error(`Falha ao carregar respostas: ${result.error.message}`);
  }

  const answersByQuestion = new Map(
    (answersResult.data ?? []).map((a) => [a.attempt_question_id, a]),
  );
  type Frozen = { type: QuestionType; stem: string; options: { id: string; body: string }[] };
  type Key = { correct: string[]; accepted: string[]; explanation: string | null };

  const answers: AttemptAnswer[] = (questionsResult.data ?? []).map((aq) => {
    const content = aq.exam_questions?.content as Frozen;
    const key = aq.exam_questions?.answer_key as Key;
    const answer = answersByQuestion.get(aq.id);
    const chosen = new Set(answer?.selected_option_ids ?? []);
    const order = aq.option_order ?? [];
    return {
      attemptQuestionId: aq.id,
      answerId: answer?.id ?? null,
      position: aq.position,
      type: content.type,
      stem: content.stem,
      points: aq.points,
      options: [...content.options]
        .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
        .map((o) => ({
          id: o.id,
          body: o.body,
          correct: key.correct.includes(o.id),
          chosen: chosen.has(o.id),
        })),
      textAnswer: answer?.text_answer ?? null,
      accepted: key.accepted ?? [],
      explanation: key.explanation ?? null,
      isCorrect: answer?.is_correct ?? null,
      pointsAwarded: answer?.points_awarded ?? null,
      needsReview: answer?.needs_review ?? false,
      gradedAt: answer?.graded_at ?? null,
    };
  });

  const row = attempt as unknown as AttemptRow;
  const result = scoreOf(row);
  const nextPending =
    (pendingResult.data ?? [])
      .map((p) => ({ id: p.id, name: p.students?.full_name ?? "" }))
      .sort((a, b) => collator.compare(a.name, b.name))[0] ?? null;

  return {
    attempt: {
      id: attempt.id,
      assignmentId: attempt.assignment_id,
      status: attempt.status,
      attemptNumber: attempt.attempt_number,
      startedAt: attempt.started_at,
      finalizedAt: attempt.finalized_at,
      finalizeReason: attempt.finalize_reason,
      maxScore: attempt.max_score,
      score: result.score,
      percent: result.percent,
      partial: result.partial,
      studentName: attempt.students?.full_name ?? "",
      registrationCode: attempt.students?.registration_code ?? "",
    },
    answers,
    events: eventsResult.data ?? [],
    nextPending,
  };
}

// ---------------------------------------------------------------------------
// Boletim da turma (alunos × provas) e visão geral
// ---------------------------------------------------------------------------

export type GradebookCell = {
  attemptId: string | null;
  situation: Situation;
  percent: number | null;
  score: number | null;
  maxScore: number | null;
  partial: boolean;
};

export async function getClassGradebook(classId: string) {
  if (!isUuid(classId)) notFound();
  await getCurrentUser();
  const supabase = await createClient();

  const { data: turma, error } = await supabase
    .from("classes")
    .select("id, name, school_year, class_students(students(id, full_name, registration_code))")
    .eq("id", classId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar a turma: ${error.message}`);
  if (!turma) notFound();

  const { data: assignments, error: aError } = await supabase
    .from("exam_assignments")
    .select("id, exam_id, opens_at, closes_at, closed_at, exams(title)")
    .eq("class_id", classId)
    .order("opens_at");
  if (aError) throw new Error(`Falha ao carregar provas: ${aError.message}`);

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: attempts, error: tError } = assignmentIds.length
    ? await supabase
        .from("exam_attempts")
        .select(ATTEMPT_COLUMNS)
        .in("assignment_id", assignmentIds)
    : { data: [], error: null };
  if (tError) throw new Error(`Falha ao carregar notas: ${tError.message}`);

  const now = new Date();
  const columns = (assignments ?? []).map((a) => ({
    assignmentId: a.id,
    examId: a.exam_id,
    title: a.exams?.title ?? "",
    opensAt: a.opens_at,
    closed: new Date(a.closed_at ?? a.closes_at) <= now || new Date(a.closes_at) <= now,
  }));

  const byAssignment = new Map<string, Map<string, AttemptRow>>();
  for (const column of columns) {
    const rows = (attempts ?? []).filter(
      (t) => t.assignment_id === column.assignmentId,
    ) as AttemptRow[];
    byAssignment.set(column.assignmentId, latestByStudent(rows).latest);
  }

  const students = turma.class_students
    .map(({ students: s }) => s)
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => collator.compare(a.full_name, b.full_name))
    .map((s) => ({
      studentId: s.id,
      fullName: s.full_name,
      registrationCode: s.registration_code,
      cells: columns.map((column): GradebookCell => {
        const attempt = byAssignment.get(column.assignmentId)?.get(s.id) ?? null;
        const result = attempt ? scoreOf(attempt) : { score: null, percent: null, partial: false };
        return {
          attemptId: attempt?.id ?? null,
          situation: situationOf(
            attempt ? { status: attempt.status, gradingStatus: attempt.grading_status } : null,
            column.closed,
          ),
          percent: result.percent,
          score: result.score,
          maxScore: attempt?.max_score ?? null,
          partial: result.partial,
        };
      }),
    }));

  return {
    turma: { id: turma.id, name: turma.name, schoolYear: turma.school_year },
    columns,
    students,
  };
}

export type ClassOverview = {
  classId: string;
  name: string;
  schoolYear: number | null;
  studentCount: number;
  examCount: number;
  meanPercent: number | null;
  pendingReviews: number;
  lowCount: number;
};

/** Resumo de cada turma ativa para a página "Notas". */
export async function getGradesOverview(): Promise<ClassOverview[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [classesResult, attemptsResult, assignmentsResult] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, school_year, class_students(count)")
      .eq("workspace_id", user.workspace.id)
      .is("archived_at", null),
    supabase
      .from("exam_attempts")
      .select(`${ATTEMPT_COLUMNS}, class_id`)
      .eq("workspace_id", user.workspace.id)
      .limit(10000),
    supabase.from("exam_assignments").select("id, class_id").eq("workspace_id", user.workspace.id),
  ]);
  for (const result of [classesResult, attemptsResult, assignmentsResult]) {
    if (result.error) throw new Error(`Falha ao carregar notas: ${result.error.message}`);
  }

  return (classesResult.data ?? [])
    .map((c) => {
      const rows = (attemptsResult.data ?? []).filter((t) => t.class_id === c.id) as (AttemptRow & {
        class_id: string;
      })[];
      // Última tentativa por aluno e prova.
      const latest = new Map<string, AttemptRow>();
      for (const row of rows) {
        const key = `${row.assignment_id}:${row.student_id}`;
        const current = latest.get(key);
        if (!current || row.attempt_number > current.attempt_number) latest.set(key, row);
      }
      const finalized = [...latest.values()].filter(
        (t) => t.status === "submitted" || t.status === "expired",
      );
      const percents = finalized
        .map((t) => scoreOf(t).percent)
        .filter((p): p is number => p !== null);
      const mean = percents.length
        ? Math.round((percents.reduce((s, p) => s + p, 0) / percents.length) * 10) / 10
        : null;
      return {
        classId: c.id,
        name: c.name,
        schoolYear: c.school_year,
        studentCount: c.class_students[0]?.count ?? 0,
        examCount: (assignmentsResult.data ?? []).filter((a) => a.class_id === c.id).length,
        meanPercent: mean,
        pendingReviews: finalized.filter((t) => t.grading_status === "pending_review").length,
        lowCount: percents.filter((p) => p < 50).length,
      };
    })
    .sort((a, b) => (b.schoolYear ?? 0) - (a.schoolYear ?? 0) || collator.compare(a.name, b.name));
}
