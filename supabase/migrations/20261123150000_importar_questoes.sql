-- =============================================================================
-- Importação de questões por planilha (retorno do piloto, 2026-11-23).
--
-- import_exam_questions grava várias questões no banco do professor e as adiciona à
-- prova numa ÚNICA transação: ou entram todas, ou nenhuma. Reaproveita save_question
-- (mesmas regras do editor) e add_questions_to_exam (mesmas travas de prova publicada).
-- Executa com as permissões de quem chama (RLS).
-- Entrada: [{"type", "stem", "explanation", "points", "tags": [...], "options": [{"body", "is_correct"}]}]
-- =============================================================================

create function public.import_exam_questions(p_exam_id uuid, p_questions jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_exam public.exams;
  v_item jsonb;
  v_ids uuid[] := array[]::uuid[];
begin
  if jsonb_typeof(p_questions) is distinct from 'array' or jsonb_array_length(p_questions) = 0 then
    raise exception 'A lista de questões está vazia.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_questions) > 100 then
    raise exception 'Importe no máximo 100 questões por vez.' using errcode = '22023';
  end if;

  select e.* into v_exam from public.exams e where e.id = p_exam_id;
  if v_exam.id is null then
    raise exception 'Prova não encontrada.' using errcode = 'P0002';
  end if;
  if v_exam.status <> 'draft' then
    raise exception 'A prova está publicada: volte-a para rascunho para incluir questões.' using errcode = '55000';
  end if;

  for v_item in select * from jsonb_array_elements(p_questions)
  loop
    v_ids := v_ids || public.save_question(
      null,
      v_exam.workspace_id,
      (v_item ->> 'type')::public.question_type,
      v_item ->> 'stem',
      nullif(v_item ->> 'explanation', ''),
      (v_item ->> 'points')::numeric,
      coalesce(array(select jsonb_array_elements_text(coalesce(v_item -> 'tags', '[]'::jsonb))), '{}'),
      coalesce(v_item -> 'options', '[]'::jsonb)
    );
  end loop;

  perform public.add_questions_to_exam(p_exam_id, v_ids);
  return array_length(v_ids, 1);
end;
$$;

revoke all on function public.import_exam_questions(uuid, jsonb) from public, anon;
grant execute on function public.import_exam_questions(uuid, jsonb) to authenticated;
