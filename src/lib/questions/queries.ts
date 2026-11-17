import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";
import type { QuestionType } from "./types";

export const QUESTIONS_PAGE_SIZE = 20;

export type QuestionListItem = {
  id: string;
  type: QuestionType;
  stem: string;
  points: number;
  tags: string[];
  optionCount: number;
};

export type QuestionFilters = {
  type?: QuestionType;
  tag?: string;
  search?: string;
  page: number;
};

/** Escapa curingas do LIKE para buscar o texto literalmente. */
function likePattern(search: string) {
  return `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listQuestions(filters: QuestionFilters) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const from = (filters.page - 1) * QUESTIONS_PAGE_SIZE;

  let query = supabase
    .from("questions")
    .select("id, type, stem, default_points, tags, question_options(count)", { count: "exact" })
    .eq("workspace_id", user.workspace.id)
    .order("created_at", { ascending: false })
    .range(from, from + QUESTIONS_PAGE_SIZE - 1);

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.tag) query = query.contains("tags", [filters.tag]);
  if (filters.search) query = query.ilike("stem", likePattern(filters.search));

  const { data, count, error } = await query;
  if (error) throw new Error(`Falha ao listar questões: ${error.message}`);

  const items: QuestionListItem[] = data.map((row) => ({
    id: row.id,
    type: row.type,
    stem: row.stem,
    points: row.default_points,
    tags: row.tags,
    optionCount: row.question_options[0]?.count ?? 0,
  }));

  return { items, total: count ?? 0 };
}

/** Assuntos usados no banco, do mais frequente para o menos frequente. */
export async function listQuestionTags(): Promise<string[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .select("tags")
    .eq("workspace_id", user.workspace.id)
    .limit(2000);
  if (error) throw new Error(`Falha ao listar assuntos: ${error.message}`);

  const counts = new Map<string, number>();
  for (const row of data) for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .map(([tag]) => tag);
}

export type QuestionDetail = {
  id: string;
  type: QuestionType;
  stem: string;
  explanation: string | null;
  points: number;
  tags: string[];
  options: { body: string; isCorrect: boolean }[];
};

export async function getQuestion(questionId: string): Promise<QuestionDetail> {
  if (!isUuid(questionId)) notFound();
  await getCurrentUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("questions")
    .select(
      "id, type, stem, explanation, default_points, tags, question_options(body, is_correct, position)",
    )
    .eq("id", questionId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar a questão: ${error.message}`);
  if (!data) notFound();

  return {
    id: data.id,
    type: data.type,
    stem: data.stem,
    explanation: data.explanation,
    points: data.default_points,
    tags: data.tags,
    options: [...data.question_options]
      .sort((a, b) => a.position - b.position)
      .map((o) => ({ body: o.body, isCorrect: o.is_correct })),
  };
}
