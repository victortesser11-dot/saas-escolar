import "server-only";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export type Subject = { id: string; name: string };

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

export function sortSubjects<T extends { name: string }>(subjects: T[]): T[] {
  return [...subjects].sort((a, b) => collator.compare(a.name, b.name));
}

/** Disciplinas do professor (para sugestões nos formulários). */
export async function listSubjects(): Promise<Subject[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("id, name")
    .eq("workspace_id", user.workspace.id);
  if (error) throw new Error(`Falha ao listar disciplinas: ${error.message}`);
  return sortSubjects(data);
}

/**
 * Id da disciplina com esse nome (sem diferenciar maiúsculas/acentos digitados iguais),
 * criando-a se ainda não existir. Nome já normalizado (normalizeSubjectName).
 */
export async function ensureSubjectId(
  supabase: Client,
  workspaceId: string,
  name: string,
): Promise<string | null> {
  const find = async () => {
    const { data } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .ilike(
        "name",
        name.replace(/[\\%_]/g, (c) => `\\${c}`),
      );
    return data?.[0]?.id ?? null;
  };

  const existing = await find();
  if (existing) return existing;

  const { data, error } = await supabase
    .from("subjects")
    .insert({ workspace_id: workspaceId, name })
    .select("id")
    .single();
  if (data) return data.id;
  // Criada ao mesmo tempo por outra requisição (nome único): usa a existente.
  if (error?.code === "23505") return find();
  return null;
}

/** Garante as disciplinas e as vincula à turma. Retorna false se algo falhar. */
export async function linkSubjectsToClass(
  supabase: Client,
  workspaceId: string,
  classId: string,
  names: string[],
): Promise<boolean> {
  for (const name of names) {
    const subjectId = await ensureSubjectId(supabase, workspaceId, name);
    if (!subjectId) return false;
    const { error } = await supabase
      .from("class_subjects")
      .upsert(
        { workspace_id: workspaceId, class_id: classId, subject_id: subjectId },
        { onConflict: "class_id,subject_id", ignoreDuplicates: true },
      );
    if (error) return false;
  }
  return true;
}
