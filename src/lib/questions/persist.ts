import "server-only";
import { getCurrentUser } from "@/lib/auth/session";
import { GENERIC_SAVE_ERROR } from "@/lib/classes/messages";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import { questionSchema, toQuestionErrors, type QuestionInput } from "./schema";

export type PersistQuestionResult =
  | { ok: true; id: string; type: string }
  | { ok: false; message?: string; errors: Record<string, string> };

/**
 * Valida e grava uma questão no banco (criação quando questionId = null).
 * A função save_question no banco repete as regras como garantia final.
 */
export async function persistQuestion(
  questionId: string | null,
  input: QuestionInput,
): Promise<PersistQuestionResult> {
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: toQuestionErrors(parsed.error) };
  if (questionId !== null && !isUuid(questionId)) {
    return { ok: false, message: GENERIC_SAVE_ERROR, errors: {} };
  }

  const user = await getCurrentUser();
  const supabase = await createClient();
  const data = parsed.data;

  // Os tipos gerados não marcam parâmetros SQL como anuláveis; null é aceito pela função.
  const { data: id, error } = await supabase.rpc("save_question", {
    p_question_id: questionId as string,
    p_workspace_id: user.workspace.id,
    p_type: data.type,
    p_stem: data.stem,
    p_explanation: data.explanation as string,
    p_points: data.points,
    p_tags: data.tags,
    p_options: data.options.map((o) => ({ body: o.body, is_correct: o.isCorrect })),
  });

  if (error || !id) {
    // 22023 = regra de tipo violada no banco (não deveria ocorrer após a validação acima).
    const message = error?.code === "22023" ? error.message : GENERIC_SAVE_ERROR;
    return { ok: false, message, errors: {} };
  }
  return { ok: true, id, type: data.type };
}
