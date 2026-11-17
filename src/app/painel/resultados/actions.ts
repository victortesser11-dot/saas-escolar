"use server";

import { refresh } from "next/cache";
import { parsePoints } from "@/lib/questions/points";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

/*
 * Ações do professor sobre as aplicações: liberar, encerrar e corrigir.
 * A autorização é verificada nas funções do banco (participação no espaço).
 */

const RELEASE_ERRORS: Record<string, string> = {
  assignment_closed:
    "A prova já foi encerrada nesta turma. Para liberar, ajuste o horário de fechamento.",
  not_interrupted: "Só é possível retomar uma prova interrompida.",
  attempt_in_progress: "O aluno ainda está fazendo a prova.",
  no_attempt: "O aluno ainda não começou a prova.",
};

export async function grantRelease(
  assignmentId: string,
  studentId: string,
  kind: "resume" | "new_attempt",
  extraMinutes: number,
): Promise<{ ok: boolean; message?: string }> {
  if (!isUuid(assignmentId) || !isUuid(studentId)) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("grant_release", {
    p_assignment_id: assignmentId,
    p_student_id: studentId,
    p_kind: kind,
    p_extra_minutes: Math.max(0, Math.min(240, Math.round(extraMinutes || 0))),
    p_reason: "" as string,
  });
  const result = data as { ok?: boolean; error?: string } | null;
  if (error || !result?.ok) {
    return {
      ok: false,
      message: RELEASE_ERRORS[result?.error ?? ""] ?? "Não foi possível liberar agora.",
    };
  }
  refresh();
  return { ok: true };
}

export async function finalizeAttemptByTeacher(attemptId: string): Promise<void> {
  if (!isUuid(attemptId)) return;
  const supabase = await createClient();
  await supabase.rpc("teacher_finalize_attempt", { p_attempt_id: attemptId });
  refresh();
}

export async function gradeAnswer(
  answerId: string,
  rawPoints: string,
  maxPoints: number,
): Promise<{ ok: boolean; message?: string }> {
  if (!isUuid(answerId)) return { ok: false, message: "Resposta inválida." };
  const normalized = rawPoints.trim();
  const points = normalized === "0" || normalized === "0,0" ? 0 : parsePoints(normalized);
  if (points === null || points > maxPoints) {
    return { ok: false, message: `Informe de 0 a ${String(maxPoints).replace(".", ",")} pontos.` };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("grade_answer", {
    p_answer_id: answerId,
    p_points: points,
  });
  const result = data as { ok?: boolean; error?: string } | null;
  if (error || !result?.ok) return { ok: false, message: "Não foi possível salvar a correção." };
  refresh();
  return { ok: true };
}
