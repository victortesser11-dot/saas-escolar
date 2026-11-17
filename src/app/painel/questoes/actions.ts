"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { GENERIC_SAVE_ERROR } from "@/lib/classes/messages";
import { questionSchema, toQuestionErrors, type QuestionInput } from "@/lib/questions/schema";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export type SaveQuestionResult = {
  status: "error";
  message?: string;
  errors: Record<string, string>;
};

/**
 * Cria (questionId = null) ou atualiza uma questão. A validação é repetida aqui
 * e, por fim, na função save_question do banco.
 * `next`: para onde ir depois de salvar ("list" ou "new" = criar outra do mesmo tipo).
 */
export async function saveQuestion(
  questionId: string | null,
  input: QuestionInput,
  next: "list" | "new",
): Promise<SaveQuestionResult> {
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { status: "error", errors: toQuestionErrors(parsed.error) };
  if (questionId !== null && !isUuid(questionId)) {
    return { status: "error", message: GENERIC_SAVE_ERROR, errors: {} };
  }

  const user = await getCurrentUser();
  const supabase = await createClient();
  const data = parsed.data;

  // Os tipos gerados não marcam parâmetros SQL como anuláveis; null é aceito pela função.
  const { error } = await supabase.rpc("save_question", {
    p_question_id: questionId as string,
    p_workspace_id: user.workspace.id,
    p_type: data.type,
    p_stem: data.stem,
    p_explanation: data.explanation as string,
    p_points: data.points,
    p_tags: data.tags,
    p_options: data.options.map((o) => ({ body: o.body, is_correct: o.isCorrect })),
  });

  if (error) {
    // 22023 = regra de tipo violada no banco (não deveria ocorrer após a validação acima).
    const message = error.code === "22023" ? error.message : GENERIC_SAVE_ERROR;
    return { status: "error", message, errors: {} };
  }

  revalidatePath("/painel/questoes");
  redirect(
    // `salva` único: reinicia o editor a cada "Salvar e criar outra".
    next === "new"
      ? `/painel/questoes/nova?tipo=${data.type}&salva=${Date.now()}`
      : "/painel/questoes?salva=1",
  );
}

export async function deleteQuestion(questionId: string): Promise<void> {
  if (!isUuid(questionId)) return;
  const supabase = await createClient();
  await supabase.from("questions").delete().eq("id", questionId);
  revalidatePath("/painel/questoes");
  redirect("/painel/questoes");
}
