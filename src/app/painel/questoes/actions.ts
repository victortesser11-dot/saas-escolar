"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { persistQuestion } from "@/lib/questions/persist";
import type { QuestionInput } from "@/lib/questions/schema";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export type SaveQuestionResult = {
  status: "error";
  message?: string;
  errors: Record<string, string>;
};

/**
 * Cria (questionId = null) ou atualiza uma questão do banco.
 * `returnToExam`: ao editar a partir de uma prova, volta para ela depois de salvar.
 * `next`: "list" volta para a lista; "new" abre outra questão do mesmo tipo.
 */
export async function saveQuestion(
  questionId: string | null,
  returnToExam: string | null,
  input: QuestionInput,
  next: "list" | "new",
): Promise<SaveQuestionResult> {
  const result = await persistQuestion(questionId, input);
  if (!result.ok) return { status: "error", message: result.message, errors: result.errors };

  revalidatePath("/painel/questoes");
  if (returnToExam && isUuid(returnToExam)) {
    revalidatePath(`/painel/provas/${returnToExam}`);
    redirect(`/painel/provas/${returnToExam}`);
  }
  redirect(
    // `salva` único: reinicia o editor a cada "Salvar e criar outra".
    next === "new"
      ? `/painel/questoes/nova?tipo=${result.type}&salva=${Date.now()}`
      : "/painel/questoes?salva=1",
  );
}

export async function deleteQuestion(questionId: string): Promise<void> {
  if (!isUuid(questionId)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("questions").delete().eq("id", questionId);
  if (error?.code === "23503") {
    // Questão usada em alguma prova: o banco impede a exclusão.
    redirect(`/painel/questoes/${questionId}?erro=em-uso`);
  }
  revalidatePath("/painel/questoes");
  redirect("/painel/questoes");
}
