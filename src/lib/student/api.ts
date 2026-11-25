import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { QuestionType } from "@/lib/questions/types";

/*
 * Acesso do aluno: sem conta e sem sessão. Usa a chave pública e chama apenas as
 * funções da prova (o papel anon não lê nenhuma tabela). O tráfego vai direto do
 * celular para o Supabase, sem passar pelo servidor do Next.js.
 */

let browserClient: SupabaseClient<Database> | null = null;

export function studentClient(): SupabaseClient<Database> {
  const { url, publishableKey } = getSupabaseEnv();
  if (typeof window === "undefined") {
    return createSupabaseClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  browserClient ??= createSupabaseClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return browserClient;
}

export type ExamEntry =
  | { error: string }
  | {
      title: string;
      instructions: string | null;
      class_name: string;
      subject_name?: string | null;
      period?: string | null;
      teacher_name?: string | null;
      state: "scheduled" | "open" | "closed";
      opens_at: string;
      closes_at: string;
      time_limit_minutes: number | null;
      question_count: number;
      requires_access_code: boolean;
    };

export type StudentQuestion = {
  id: string;
  position: number;
  type: QuestionType;
  stem: string;
  points: number;
  options: { id: string; body: string }[];
};

export type SavedAnswer = { selected: string[]; text: string | null };

export type ResultItem = {
  position: number;
  type: QuestionType;
  stem: string;
  points: number;
  points_awarded: number | null;
  is_correct: boolean | null;
  needs_review: boolean;
  your_answer: string[] | string | null;
  correct_answer: string[] | null;
};

export type AttemptResult = {
  status: "submitted" | "expired";
  finalize_reason: "submitted" | "expired" | "teacher" | null;
  score: number | null;
  max_score: number | null;
  pending_review: boolean;
  items: ResultItem[] | null;
};

export type AttemptState =
  | { error: string }
  | { status: "interrupted" }
  | { status: "submitted" | "expired"; result: AttemptResult }
  | {
      status: "in_progress";
      title: string;
      instructions: string | null;
      student_name: string;
      class_name: string;
      expires_at: string;
      has_time_limit: boolean;
      server_now: string;
      questions: StudentQuestion[];
      answers: Record<string, SavedAnswer>;
    };

export async function getExamEntry(code: string): Promise<ExamEntry> {
  const { data, error } = await studentClient().rpc("get_exam_entry", { p_code: code });
  if (error || !data) return { error: "connection" };
  return data as unknown as ExamEntry;
}

export async function startAttempt(input: {
  code: string;
  registration: string;
  name: string;
  accessCode: string;
  resumeToken: string | null;
}): Promise<{ token: string } | { error: string }> {
  const { data, error } = await studentClient().rpc("start_attempt", {
    p_code: input.code,
    p_registration: input.registration,
    p_name: input.name,
    p_access_code: input.accessCode,
    // Os tipos gerados não marcam parâmetros SQL como anuláveis; null é aceito.
    p_resume_token: input.resumeToken as string,
  });
  if (error || !data) return { error: "connection" };
  return data as unknown as { token: string } | { error: string };
}

export async function getAttempt(token: string): Promise<AttemptState> {
  const { data, error } = await studentClient().rpc("get_attempt", { p_token: token });
  if (error || !data) return { error: "connection" };
  return data as unknown as AttemptState;
}

export async function saveAnswer(
  token: string,
  questionId: string,
  answer: SavedAnswer,
): Promise<{ ok: true } | { error: string; status?: string }> {
  const { data, error } = await studentClient().rpc("save_answer", {
    p_token: token,
    p_attempt_question_id: questionId,
    p_selected: answer.selected,
    p_text: answer.text as string,
  });
  if (error || !data) return { error: "connection" };
  return data as unknown as { ok: true } | { error: string };
}

export async function submitAttempt(
  token: string,
): Promise<{ status: string; result: AttemptResult } | { error: string }> {
  const { data, error } = await studentClient().rpc("submit_attempt", { p_token: token });
  if (error || !data) return { error: "connection" };
  return data as unknown as { status: string; result: AttemptResult } | { error: string };
}
